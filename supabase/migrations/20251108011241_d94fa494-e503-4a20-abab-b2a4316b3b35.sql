-- Drop the existing restrictive policy for viewing custom requests
DROP POLICY IF EXISTS "Users can view their own requests" ON custom_requests;

-- Create new policy that allows buyers to view their own requests
CREATE POLICY "Buyers can view their requests"
ON custom_requests
FOR SELECT
USING (auth.uid() = buyer_id);

-- Create new policy that allows all artists to view all custom requests
CREATE POLICY "Artists can view all requests"
ON custom_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'artist'
  )
);