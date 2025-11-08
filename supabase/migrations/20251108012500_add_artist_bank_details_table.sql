-- Create table for artist's bank details, linked to their profile/user ID
CREATE TABLE public.artist_bank_details (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on artist_bank_details
ALTER TABLE public.artist_bank_details ENABLE ROW LEVEL SECURITY;

-- Policies for artist_bank_details: only the owner can manage their details

-- Only the owner (artist) can view their bank details
CREATE POLICY "Artists can view their own bank details"
  ON public.artist_bank_details
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the owner (artist) can insert their bank details
CREATE POLICY "Artists can insert their own bank details"
  ON public.artist_bank_details
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owner (artist) can update their bank details
CREATE POLICY "Artists can update their own bank details"
  ON public.artist_bank_details
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at column (using the existing function)
CREATE TRIGGER update_artist_bank_details_updated_at
  BEFORE UPDATE ON public.artist_bank_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();