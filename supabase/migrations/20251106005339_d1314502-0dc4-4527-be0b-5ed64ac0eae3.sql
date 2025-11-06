-- Add stock_quantity column to artworks table
ALTER TABLE public.artworks 
ADD COLUMN stock_quantity integer NOT NULL DEFAULT 1 CHECK (stock_quantity >= 0 AND stock_quantity <= 10);

-- Update existing artworks to have default stock of 1
UPDATE public.artworks SET stock_quantity = 1 WHERE stock_quantity IS NULL;