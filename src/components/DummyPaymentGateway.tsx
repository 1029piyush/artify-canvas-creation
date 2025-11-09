import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Wallet, Landmark, CreditCard } from "lucide-react";

interface DummyPaymentGatewayProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onPaymentSuccess: () => void;
}

export const DummyPaymentGateway = ({
  isOpen,
  onOpenChange,
  amount,
  onPaymentSuccess,
}: DummyPaymentGatewayProps) => {
  const [step, setStep] = useState<"payment" | "success">("payment");

  // Reset to first step when dialog is closed
  useEffect(() => {
    if (!isOpen) {
      // Add a small delay so the content doesn't flash on close
      const timer = setTimeout(() => {
        setStep("payment");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleDummyPayment = () => {
    // Simulate a payment processing delay
    setStep("success");
  };

  const handleCloseDialog = () => {
    onOpenChange(false);
    // Call the original checkout function *after* success
    onPaymentSuccess();
  };

  const dummyQRUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=dummy@upi&pn=Artify&am=${amount.toFixed(
    2
  )}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "payment" && (
          <>
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
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDummyPayment}
                >
                  <Wallet className="mr-2 h-4 w-4" /> Google Pay
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDummyPayment}
                >
                  <Landmark className="mr-2 h-4 w-4" /> Bank Transfer
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDummyPayment}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Credit/Debit Card
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <CheckCircle className="h-24 w-24 text-green-500 animate-in fade-in zoom-in-50" />
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
            <p className="text-lg text-muted-foreground">
              ₹{amount.toFixed(2)} paid to Artify
            </p>
            <p className="text-sm">Your order is being placed...</p>
            <Button
              className="w-full mt-4"
              onClick={handleCloseDialog}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DummyPaymentGateway;