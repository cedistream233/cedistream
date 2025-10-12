import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Purchase } from "@/entities/Purchase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, ShoppingBag, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Cart() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  // UI-only map that keeps inputs empty initially even if a minimum exists
  const [amountInputs, setAmountInputs] = useState({});

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      const items = userData.cart || [];
      setCart(items);
      // initialize inputs to empty so users see a blank field but min is enforced
      const init = {};
      for (const it of items) init[it.item_id] = '';
      setAmountInputs(init);
    } catch (error) {
      navigate(createPageUrl("Home"));
    }
  };

  const removeFromCart = async (itemId) => {
    const updatedCart = cart.filter(item => item.item_id !== itemId);
    await User.updateMyUserData({ cart: updatedCart });
    setCart(updatedCart);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    
    // Create purchase records
    for (const item of cart) {
      await Purchase.create({
        user_email: user.email,
        item_type: item.item_type,
        item_id: item.item_id,
        item_title: item.title,
        amount: item.price,
        payment_status: "pending"
      });
    }

    // Navigate to checkout page
    navigate(createPageUrl("Checkout"));
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <ShoppingBag className="w-24 h-24 mx-auto text-gray-600 mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Your cart is empty</h2>
          <p className="text-gray-400 mb-8">Discover amazing content and add items to your cart</p>
          <Button
            onClick={() => navigate(createPageUrl("Home"))}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            Browse Content
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold text-white mb-8">Shopping Cart</h1>

      <div className="space-y-4 mb-8">
        {cart.map((item) => (
          <Card key={item.item_id} className="bg-slate-900/50 border-purple-900/20 p-6">
            <div className="flex items-center gap-6">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-24 h-24 rounded-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-purple-900 to-pink-900 rounded-lg" />
              )}

              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-gray-400 capitalize">{item.item_type}</p>
              </div>

              <div className="text-right">
                <div className="mb-2 text-xs text-gray-400">Minimum: GH₵ {(Number(item.min_price||item.price)||0).toFixed(2)}</div>
                <div className="flex items-center gap-2 mb-4 justify-end">
                  <span className="text-gray-300 text-sm">Amount:</span>
                  <input
                    type="number"
                    min={Number(item.min_price||item.price)||0}
                    placeholder={`Min ${(Number(item.min_price||item.price)||0).toFixed(2)}`}
                    value={amountInputs[item.item_id] ?? ''}
                    onChange={async (e) => {
                      const raw = e.target.value;
                      // allow temporarily empty; clamp any number entered to the minimum
                      setAmountInputs(prev => ({ ...prev, [item.item_id]: raw }));
                      if (raw === '' || raw === undefined) return; // don't change stored price yet
                      const min = Number(item.min_price || item.price) || 0;
                      const num = Number(raw);
                      const clamped = isNaN(num) ? min : Math.max(min, num);
                      // reflect clamped value in the UI if user typed below min
                      if (!isNaN(num) && num < min) {
                        setAmountInputs(prev => ({ ...prev, [item.item_id]: String(clamped) }));
                      }
                      const nextCart = cart.map(ci => ci.item_id === item.item_id ? { ...ci, price: clamped } : ci);
                      setCart(nextCart);
                      await User.updateMyUserData({ cart: nextCart });
                    }}
                    onBlur={async () => {
                      // ensure cart keeps at least the minimum
                      const min = Number(item.min_price || item.price) || 0;
                      const nextCart = cart.map(ci => ci.item_id === item.item_id ? { ...ci, price: Math.max(min, Number(ci.price||0)) } : ci);
                      setCart(nextCart);
                      await User.updateMyUserData({ cart: nextCart });
                    }}
                    className="w-32 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-right placeholder:text-slate-500"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFromCart(item.item_id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900/50 border-purple-900/20 p-6">
        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            You can increase the amount above the minimum to show extra support. Every cedi goes directly to the creator.
          </div>
          <div className="flex items-center justify-between text-lg">
            <span className="text-gray-400">Items:</span>
            <span className="text-white">{cart.length}</span>
          </div>
          <div className="flex items-center justify-between text-2xl font-bold border-t border-purple-900/20 pt-4">
            <span className="text-white">Total:</span>
            <span className="text-yellow-400">GH₵ {calculateTotal().toFixed(2)}</span>
          </div>

          <Button
            onClick={handleCheckout}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6 mt-6"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            {isProcessing ? "Processing..." : "Proceed to Checkout"}
          </Button>
        </div>
      </Card>
    </div>
  );
}