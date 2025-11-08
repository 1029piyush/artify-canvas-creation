-- Add admin to app_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'admin') THEN
    ALTER TYPE app_role ADD VALUE 'admin';
  END IF;
END $$;

-- Update custom_requests RLS to allow artists to claim requests
DROP POLICY IF EXISTS "Buyers can update their requests" ON custom_requests;

CREATE POLICY "Buyers can update their requests"
ON custom_requests
FOR UPDATE
USING (auth.uid() = buyer_id);

CREATE POLICY "Artists can claim requests"
ON custom_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'artist'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'artist'::app_role
  )
);

-- Create payment_details table
CREATE TABLE IF NOT EXISTS payment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('upi', 'bank')),
  upi_id text,
  bank_name text,
  account_number text,
  ifsc_code text,
  account_holder_name text,
  transaction_id text,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on payment_details
ALTER TABLE payment_details ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_details
CREATE POLICY "Users can view their payment details"
ON payment_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = payment_details.order_id 
    AND (orders.buyer_id = auth.uid() OR orders.artist_id = auth.uid())
  )
);

CREATE POLICY "Buyers can create payment details"
ON payment_details
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = payment_details.order_id 
    AND orders.buyer_id = auth.uid()
  )
);

-- Update artworks RLS to allow admins to delete
CREATE POLICY "Admins can delete any artwork"
ON artworks
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for payment_details updated_at
CREATE TRIGGER update_payment_details_updated_at
BEFORE UPDATE ON payment_details
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();