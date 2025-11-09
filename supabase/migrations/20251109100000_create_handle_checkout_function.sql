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
    total_items_processed INT := 0;
BEGIN
    -- This is an atomic transaction.
    -- If any check fails, the entire block is rolled back.

    FOR cart_item_record IN
        SELECT * FROM public.cart_items WHERE user_id = p_buyer_id
    LOOP
        -- Get the artwork details and
        -- LOCK THE ROW using FOR UPDATE.
        -- This is the key fix for the race condition.
        -- No other transaction can touch this row until this one is done.
        SELECT * INTO artwork_record
        FROM public.artworks
        WHERE id = cart_item_record.artwork_id
        FOR UPDATE;

        -- Check if stock is sufficient
        IF artwork_record.stock_quantity < cart_item_record.quantity THEN
            -- If stock is insufficient, stop everything and
            -- roll back all changes.
            RAISE EXCEPTION 'Insufficient stock for artwork: % (Only % available)',
                artwork_record.title, artwork_record.stock_quantity;
        END IF;

        -- Stock is sufficient, so decrement it
        new_stock_quantity := artwork_record.stock_quantity - cart_item_record.quantity;

        UPDATE public.artworks
        SET stock_quantity = new_stock_quantity
        WHERE id = cart_item_record.artwork_id;

        -- Create the order
        INSERT INTO public.orders (
            buyer_id,
            artwork_id,
            artist_id,
            quantity,
            total_price,
            payment_amount,
            delivery_address_id,
            status
        )
        VALUES (
            p_buyer_id,
            cart_item_record.artwork_id,
            artwork_record.artist_id,
            cart_item_record.quantity,
            (artwork_record.price * cart_item_record.quantity),
            (artwork_record.price * cart_item_record.quantity) * 0.7, -- 70% advance
            p_delivery_address_id,
            'pending'
        );

        total_items_processed := total_items_processed + 1;

    END LOOP;

    -- If the loop finished, all orders are created and stock is decremented.
    -- Now, clear the user's cart.
    DELETE FROM public.cart_items WHERE user_id = p_buyer_id;

    -- Success!
    RETURN json_build_object(
        'success', true,
        'items_processed', total_items_processed
    );

END;
$$;