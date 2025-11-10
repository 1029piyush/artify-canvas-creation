-- Create the handle_checkout function that processes cart items atomically
CREATE OR REPLACE FUNCTION public.handle_checkout(
  p_buyer_id uuid,
  p_delivery_address_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_item RECORD;
  v_current_stock integer;
  v_order_id uuid;
  v_orders_created json[] := '{}';
BEGIN
  -- Loop through all cart items for this buyer
  FOR v_cart_item IN 
    SELECT 
      ci.id as cart_item_id,
      ci.artwork_id,
      ci.quantity,
      a.stock_quantity,
      a.price,
      a.artist_id,
      a.title
    FROM cart_items ci
    JOIN artworks a ON a.id = ci.artwork_id
    WHERE ci.user_id = p_buyer_id
    FOR UPDATE OF a  -- Lock the artwork rows
  LOOP
    -- Check if sufficient stock is available
    IF v_cart_item.stock_quantity < v_cart_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for: %. Available: %, Requested: %', 
        v_cart_item.title, 
        v_cart_item.stock_quantity, 
        v_cart_item.quantity;
    END IF;
    
    -- Atomically decrement stock
    UPDATE artworks
    SET stock_quantity = stock_quantity - v_cart_item.quantity
    WHERE id = v_cart_item.artwork_id;
    
    -- Create the order
    INSERT INTO orders (
      buyer_id,
      artist_id,
      artwork_id,
      quantity,
      total_price,
      payment_amount,
      delivery_address_id,
      status
    ) VALUES (
      p_buyer_id,
      v_cart_item.artist_id,
      v_cart_item.artwork_id,
      v_cart_item.quantity,
      v_cart_item.price * v_cart_item.quantity,
      (v_cart_item.price * v_cart_item.quantity) * 0.7,  -- 70% advance payment
      p_delivery_address_id,
      'pending'
    ) RETURNING id INTO v_order_id;
    
    -- Track created order
    v_orders_created := v_orders_created || json_build_object('order_id', v_order_id);
    
    -- Delete cart item
    DELETE FROM cart_items WHERE id = v_cart_item.cart_item_id;
  END LOOP;
  
  -- Return success with created orders
  RETURN json_build_object(
    'success', true,
    'orders', v_orders_created
  );
END;
$$;