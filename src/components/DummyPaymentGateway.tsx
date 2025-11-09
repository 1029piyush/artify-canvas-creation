import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Landmark, CreditCard, Loader2 } from "lucide-react";

// 1. Define the new props
interface DummyPaymentGatewayProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  // This prop expects an async function that might throw an error
  onSubmit: () => Promise<void>;
}

export const DummyPaymentGateway = ({
  isOpen,
  onOpenChange,
  amount,
  onSubmit, // <-- Use the new prop
}: DummyPaymentGatewayProps) => {

  // 2. Add internal state for loading and errors
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 3. Create a wrapper function to handle the submission
  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // This will run your `handleCheckout` function from Cart.tsx
      await onSubmit();
      
      // If it succeeds, handleCheckout will navigate away.
      
    } catch (err: any) {
      // If handleCheckout throws an error (e.g., "Insufficient stock"),
      // it will be caught here.
      let message = err.message || "An unknown error occurred.";
      
      // Clean up the Supabase error message
      if (message.includes("Insufficient stock for:")) {
         message = message.split('ERROR: ').pop()?.split('CONTEXT:').shift() || message;
      }
      
      setError(message.trim());
    } finally {
      // Always stop loading, even if there's an error
      setIsLoading(false);
    }
  };

  // 4. Reset state when the modal closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Add a delay to avoid flash of content
      setTimeout(() => {
        setIsLoading(false);
        setError(null);
      }, 300);
    }
    onOpenChange(open);
  };
  
  const dummyQRUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=dummy@upi&pn=Artify&am=${amount.toFixed(
    2
  )}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Complete Your Payment
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            You are paying ₹{amount.toFixed(2)} to Artify
          </p>
          <img
            src={dummyQRUrl}
            alt="Dummy UPI QR Code"
            className="rounded-lg border p-2"
            width={200}
            height={200}
          />
          <p className="font-semibold">Scan to Pay with any UPI App</p>
          
          <div className="w-full space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              Or select a dummy payment method
            </p>
            
            {/* 5. Show the error message if one exists */}
            {error && (
              <div className="p-3 text-sm text-center rounded-md bg-destructive/10 text-destructive">
                <p className="font-bold">Order Failed</p>
                <p>{error}</p>
              </div>
            )}
            
            {/* 6. Update the buttons to use the new handler and state */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
              {isLoading ? "Processing..." : "Google Pay"}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}
              {isLoading ? "Processing..." : "Bank Transfer"}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              {isLoading ? "Processing..." : "Credit/Debit Card"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DummyPaymentGateway;