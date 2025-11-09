-- This function creates a secure, atomic checkout process.
-- It runs inside a transaction, so if any part fails,
-- the whole process is rolled back.

CREATE OR REPLACE FUNCTION public.handle_checkout(
    p_buyer_id uuid,
    p_delivery_address_id uuid
)
RETURNS json -- Return a success message or error
LANGUAGE plpgsql
AS $$
DECLARE
    cart_item_record RECORD;
    artwork_record RECORD;
    new_stock_quantity INT;
    total_order_price NUMERIC := 0;
    payment_advance_amount NUMERIC := 0;
    new_order_id uuid;
    
    -- An array to hold artwork titles for stock errors
    artwork_titles TEXT[];
    out_of_stock_titles TEXT;
BEGIN
    -- This is an atomic transaction.
    -- If any check fails, the entire block is rolled back.

    -- 1. First loop: Check stock for all items and calculate total price
    --    We must lock rows as we check them.
    FOR cart_item_record IN
        SELECT 
            ci.quantity,
            a.id as artwork_id,
            a.title,
            a.price,
            a.stock_quantity
        FROM public.cart_items ci
        JOIN public.artworks a ON ci.artwork_id = a.id
        WHERE ci.user_id = p_buyer_id
    LOOP
        -- Lock the artwork row
        SELECT * INTO artwork_record
        FROM public.artworks
        WHERE id = cart_item_record.artwork_id
        FOR UPDATE;

        -- Check if stock is sufficient
        IF artwork_record.stock_quantity < cart_item_record.quantity THEN
            -- Add title to our error list
            artwork_titles := array_append(artwork_titles, artwork_record.title);
        END IF;

        -- Add to total price
        total_order_price := total_order_price + (artwork_record.price * cart_item_record.quantity);
    END LOOP;

    -- 2. After checking all items, see if any failed
    IF array_length(artwork_titles, 1) > 0 THEN
        out_of_stock_titles := array_to_string(artwork_titles, ', ');
        RAISE EXCEPTION 'Insufficient stock for: %', out_of_stock_titles;
    END IF;

    -- 3. All stock is OK. Calculate payment amount.
    payment_advance_amount := total_order_price * 0.7; -- 70% advance

    -- 4. Create ONE single order
    INSERT INTO public.orders (
        buyer_id,
        delivery_address_id,
        total_price,
        payment_amount,
        status
    )
    VALUES (
        p_buyer_id,
        p_delivery_address_id,
        total_order_price,
        payment_advance_amount,
        'pending' -- Or 'processing'
    )
    RETURNING id INTO new_order_id; -- Get the ID of the new order

    -- 5. Second loop: Decrement stock and create order_items
    FOR cart_item_record IN
        SELECT 
            ci.quantity,
            a.id as artwork_id,
            a.price,
            a.stock_quantity
        FROM public.cart_items ci
        JOIN public.artworks a ON ci.artwork_id = a.id
        WHERE ci.user_id = p_buyer_id
    LOOP
        -- Decrement stock
        new_stock_quantity := cart_item_record.stock_quantity - cart_item_record.quantity;
        UPDATE public.artworks
        SET stock_quantity = new_stock_quantity
        WHERE id = cart_item_record.artwork_id;

        -- Create the order_item linked to the new order
        INSERT INTO public.order_items (
            order_id,
            artwork_id,
            quantity,
            price_at_purchase -- Good practice to store this
        )
        VALUES (
            new_order_id,
            cart_item_record.artwork_id,
            cart_item_record.quantity,
            cart_item_record.price
        );
    END LOOP;

    -- 6. Clear the user's cart
    DELETE FROM public.cart_items WHERE user_id = p_buyer_id;

    -- 7. Success!
    RETURN json_build_object(
        'success', true,
        'order_id', new_order_id
    );

END;
$$;