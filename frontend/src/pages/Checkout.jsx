import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Purchase } from "@/entities/Purchase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, Smartphone, AlertCircle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Checkout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      
      const userPurchases = await Purchase.filter({ 
        user_email: userData.email,
        payment_status: "pending"
      });
      setPurchases(userPurchases);

      if (userPurchases.length === 0) {
        navigate(createPageUrl("Cart"));
      }
    } catch (error) {
      navigate(createPageUrl("Home"));
    }
  };

  const calculateTotal = () => {
    return purchases.reduce((sum, purchase) => sum + (purchase.amount || 0), 0);
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    // TODO: Integrate with Paystack here
    // This is where you'll need to implement the actual Paystack payment
    // For now, we'll simulate a successful payment
    
    alert("⚠️ PAYSTACK INTEGRATION NEEDED\n\nTo complete payments, enable backend functions in Dashboard → Settings.\n\nYou'll need to:\n1. Add Paystack API keys\n2. Create payment initialization endpoint\n3. Handle payment verification\n4. Update purchase status\n\nFor now, this is a placeholder.");

    setIsProcessing(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold text-white mb-8">Checkout</h1>

      <Alert className="mb-8 bg-yellow-900/20 border-yellow-500/50">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-yellow-200">
          <strong>Payment Integration Pending:</strong> To enable Paystack payments (card & mobile money), 
          please enable backend functions in Dashboard → Settings. The frontend structure is ready!
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Order Summary</h2>
          <Card className="bg-slate-900/50 border-purple-900/20 p-6 mb-6">
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{purchase.item_title}</p>
                    <p className="text-sm text-gray-400 capitalize">{purchase.item_type}</p>
                  </div>
                  <p className="text-yellow-400 font-semibold">
                    GH₵ {purchase.amount?.toFixed(2)}
                  </p>
                </div>
              ))}
              
              <div className="border-t border-purple-900/20 pt-4 mt-4">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span className="text-white">Total:</span>
                  <span className="text-yellow-400">GH₵ {calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Payment Method</h2>
          
          <div className="space-y-4 mb-6">
            <Card
              onClick={() => setPaymentMethod("card")}
              className={`p-6 cursor-pointer transition-all ${
                paymentMethod === "card"
                  ? "bg-purple-900/30 border-purple-500"
                  : "bg-slate-900/50 border-purple-900/20 hover:border-purple-700"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  paymentMethod === "card" ? "bg-purple-600" : "bg-slate-800"
                }`}>
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Card Payment</h3>
                  <p className="text-sm text-gray-400">Pay with debit/credit card</p>
                </div>
              </div>
            </Card>

            <Card
              onClick={() => setPaymentMethod("mobile_money")}
              className={`p-6 cursor-pointer transition-all ${
                paymentMethod === "mobile_money"
                  ? "bg-purple-900/30 border-purple-500"
                  : "bg-slate-900/50 border-purple-900/20 hover:border-purple-700"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  paymentMethod === "mobile_money" ? "bg-purple-600" : "bg-slate-800"
                }`}>
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Mobile Money</h3>
                  <p className="text-sm text-gray-400">MTN, Vodafone, AirtelTigo</p>
                </div>
              </div>
            </Card>
          </div>

          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
          >
            {isProcessing ? "Processing..." : `Pay GH₵ ${calculateTotal().toFixed(2)}`}
          </Button>

          <p className="text-center text-sm text-gray-400 mt-4">
            Secured by Paystack 🔒
          </p>
        </div>
      </div>
    </div>
  );
}