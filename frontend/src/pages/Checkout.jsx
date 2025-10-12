import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Purchase } from "@/entities/Purchase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, Smartphone, AlertCircle, Sparkles, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Checkout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountInputs, setAmountInputs] = useState({});
  const [minMap, setMinMap] = useState({}); // key: `${type}:${id}` -> min price

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      const localCart = Array.isArray(userData?.cart) ? userData.cart : [];
      const m = {};
      localCart.forEach(ci => { m[`${ci.item_type}:${ci.item_id}`] = Number(ci.min_price || ci.price || 0) || 0; });
      setMinMap(m);
      
      const userPurchases = await Purchase.filter({ 
        user_email: userData.email,
        payment_status: "pending"
      });
      setPurchases(userPurchases);
      // init empty amount inputs (display only) with placeholders showing item minimums
      const init = {};
      userPurchases.forEach(p => { init[p.id] = ''; });
      setAmountInputs(init);

      if (userPurchases.length === 0) {
        navigate(createPageUrl("Cart"));
      }
    } catch (error) {
      navigate(createPageUrl("Home"));
    }
  };

  const calculateTotal = () => {
    return purchases.reduce((sum, purchase) => sum + (Number(purchase.amount) || 0), 0);
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold text-white mb-8">Checkout</h1>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Alert className="md:col-span-2 bg-purple-900/20 border-purple-500/50">
          <Sparkles className="h-4 w-4 text-purple-300" />
          <AlertDescription className="text-purple-100">
            You’re in control: pay the minimum or add a little extra to support your favorite creators. Thank you for being awesome.
          </AlertDescription>
        </Alert>
        <Alert className="bg-yellow-900/20 border-yellow-500/50">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200 text-sm">
            Paystack integration placeholder. Enable in Dashboard → Settings to accept real payments.
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Order Summary + Top supporters */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Order Summary</h2>
          <Card className="bg-slate-900/50 border-purple-900/20 p-4 sm:p-6 mb-6">
            <div className="space-y-4">
              {purchases.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{p.item_title}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.item_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={(() => { const k = `${p.item_type}:${p.item_id}`; return Number(minMap[k] ?? p.amount ?? 0) || 0; })()}
                      placeholder={`Min ${(() => { const k = `${p.item_type}:${p.item_id}`; const v = Number(minMap[k] ?? p.amount ?? 0) || 0; return v.toFixed(2); })()}`}
                      value={amountInputs[p.id] ?? ''}
                      onChange={async (e) => {
                        const raw = e.target.value;
                        setAmountInputs(prev => ({ ...prev, [p.id]: raw }));
                        if (raw === '' || raw === undefined) return;
                        const k = `${p.item_type}:${p.item_id}`;
                        const min = Number(minMap[k] ?? p.amount ?? 0) || 0;
                        const num = Number(raw);
                        const clamped = isNaN(num) ? min : Math.max(min, num);
                        if (!isNaN(num) && num < min) {
                          setAmountInputs(prev => ({ ...prev, [p.id]: String(clamped) }));
                        }
                        // reflect to local state so total updates in real time
                        setPurchases(prev => prev.map(pi => pi.id === p.id ? { ...pi, amount: clamped } : pi));
                      }}
                      className="w-28 sm:w-32 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-right placeholder:text-slate-500"
                    />
                    <span className="text-yellow-400 font-semibold hidden sm:inline">GH₵ {Number(p.amount||0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-purple-900/20 pt-4 mt-2 sm:mt-4">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-yellow-400">GH₵ {calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Top supporters placeholder */}
          <Card className="bg-slate-900/40 border-purple-900/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Top Supporters
              </div>
              <span className="text-xs text-gray-400">Coming soon</span>
            </div>
            <p className="text-sm text-gray-400">
              We’ll highlight the top 5 supporters who paid the most for this content. Boost your rank by tipping extra.
            </p>
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