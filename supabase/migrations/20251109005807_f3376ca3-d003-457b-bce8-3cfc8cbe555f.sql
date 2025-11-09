-- Create artist_bank_details table
CREATE TABLE public.artist_bank_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  upi_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.artist_bank_details ENABLE ROW LEVEL SECURITY;

-- Artists can view and manage their own bank details
CREATE POLICY "Artists can view their own bank details"
ON public.artist_bank_details
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Artists can insert their own bank details"
ON public.artist_bank_details
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Artists can update their own bank details"
ON public.artist_bank_details
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all bank details
CREATE POLICY "Admins can view all bank details"
ON public.artist_bank_details
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_artist_bank_details_updated_at
BEFORE UPDATE ON public.artist_bank_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update payment_details table to add admin verification
ALTER TABLE public.payment_details
ADD COLUMN verified_by_admin BOOLEAN DEFAULT false,
ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;

-- Update orders table to add notification status
ALTER TABLE public.orders
ADD COLUMN artist_notified BOOLEAN DEFAULT false;

-- Admins can update payment verification
CREATE POLICY "Admins can update payment verification"
ON public.payment_details
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update order status
CREATE POLICY "Admins can update orders"
ON public.orders
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all payment details
CREATE POLICY "Admins can view all payments"
ON public.payment_details
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for admin dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_details;
ALTER PUBLICATION supabase_realtime ADD TABLE public.artworks;