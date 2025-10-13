import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { useAuth } from '@/contexts/AuthContext';
import { Purchase } from "@/entities/Purchase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, ShoppingBag, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function Cart() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const { updateMyUserData } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  // UI-only map that keeps inputs empty initially even if a minimum exists
  const [amountInputs, setAmountInputs] = useState({});
  const [checkoutErrors, setCheckoutErrors] = useState([]);
  // confirm modal state for removals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null); // { id, type, title }
  // derived invalid items (amount < min)
  const invalidItems = cart.map(item => {
    const raw = (amountInputs[item.item_id] ?? '').toString().trim();
    const entered = raw === '' ? Number(item.price || 0) : Number(raw);
    const min = Number(item.min_price || item.price || 0) || 0;
    const isInvalid = isNaN(entered) || entered < min;
    return isInvalid ? { id: item.item_id, title: item.title, required: min, got: isNaN(entered) ? null : entered } : null;
  }).filter(Boolean);

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

  const removeFromCart = async (itemId, itemType) => {
    // Guard: remove by both id and type to avoid accidental multi-removal when IDs overlap
    const updatedCart = cart.filter(item => !(item.item_id === itemId && item.item_type === itemType));
    // update demo_user mirror and AuthProvider via updateMyUserData so header re-renders immediately
    await updateMyUserData({ cart: updatedCart });
    setCart(updatedCart);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  };

  const handleCheckout = async () => {
    setCheckoutErrors([]);
    // Validate each cart item against its minimum
    const bad = [];
    const purchasesToCreate = [];
    for (const item of cart) {
      const raw = (amountInputs[item.item_id] ?? '').toString().trim();
      const entered = raw === '' ? Number(item.price || 0) : Number(raw);
      const min = Number(item.min_price || item.price || 0) || 0;
      if (isNaN(entered) || entered < min) {
        bad.push({ id: item.item_id, title: item.title, required: min, got: isNaN(entered) ? null : entered });
      } else {
        purchasesToCreate.push({ item, amount: entered });
      }
    }

    if (bad.length > 0) {
      setCheckoutErrors(bad);
      // scroll to top so user sees the error on small screens
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsProcessing(true);
    // Create purchase records with a shared reference to bind this checkout session
    const reference = `CDS_CART_${Date.now()}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    try {
      // persist the reference for the next step so Checkout can pass it to Paystack initialize
      const rawU = localStorage.getItem('user') || localStorage.getItem('demo_user');
      const u = rawU ? JSON.parse(rawU) : {};
      const next = { ...u, last_checkout_ref: reference };
      localStorage.setItem('user', JSON.stringify(next));
      localStorage.setItem('demo_user', JSON.stringify(next));
    } catch {}
    for (const p of purchasesToCreate) {
      await Purchase.create({
        user_id: user.id,
        user_email: user.email,
        item_type: p.item.item_type,
        item_id: p.item.item_id,
        item_title: p.item.title,
        amount: p.amount,
        payment_status: 'pending',
        payment_reference: reference
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

      {checkoutErrors.length > 0 && (
        <Alert className="mb-6 bg-red-900/20 border-red-600/40">
          <AlertDescription className="text-red-200">
            Some items are below the minimum required amount. Please update the amounts before checking out:
            <ul className="mt-2 list-disc list-inside text-sm text-red-100">
              {checkoutErrors.map(err => (
                <li key={err.id}>{err.title} — minimum GH₵ {Number(err.required).toFixed(2)}{err.got !== null ? ` (you entered GH₵ ${Number(err.got).toFixed(2)})` : ''}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 mb-8">
        {cart.map((item) => (
          <Card key={item.item_id} className="bg-slate-900/50 border-purple-900/20 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {/* Image */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900 rounded-lg" />
                )}
              </div>

              {/* Title and type */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-1 truncate">{item.title}</h3>
                <p className="text-sm text-gray-400 capitalize">{item.item_type}</p>
              </div>

              {/* Amount section - full width on mobile, right-aligned on desktop */}
              <div className="w-full sm:w-auto sm:text-right space-y-2 sm:space-y-0">
                <div className="text-xs text-gray-400 mb-2">Minimum: GH₵ {(Number(item.min_price||item.price)||0).toFixed(2)}</div>
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <span className="text-gray-300 text-sm whitespace-nowrap">Amount:</span>
                  <input
                    type="number"
                    placeholder={`Min ${(Number(item.min_price||item.price)||0).toFixed(2)}`}
                    value={amountInputs[item.item_id] ?? ''}
                    onChange={async (e) => {
                      const raw = e.target.value;
                      // allow any typed value (including below min); store entered number in cart so totals update
                      setAmountInputs(prev => ({ ...prev, [item.item_id]: raw }));
                      const num = Number(raw);
                      const stored = isNaN(num) ? 0 : num;
                      const nextCart = cart.map(ci => ci.item_id === item.item_id ? { ...ci, price: stored } : ci);
                      setCart(nextCart);
                      await updateMyUserData({ cart: nextCart });
                    }}
                    className="flex-1 sm:w-32 bg-slate-800 border border-slate-700 text-white rounded px-3 py-2 text-right placeholder:text-slate-500"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPendingRemoval({ id: item.item_id, type: item.item_type, title: item.title }); setConfirmOpen(true); }}
                  className="text-red-400 hover:text-red-300 w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900/50 border-purple-900/20 p-6">
        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            You can contribute more than the minimum to show extra support. Top three supporters will be featured on the content’s leaderboard.
          </div>
          <div className="flex items-center justify-between text-lg">
            <span className="text-gray-400">Items:</span>
            <span className="text-white">{cart.length}</span>
          </div>
          <div className="flex items-center justify-between text-2xl font-bold border-t border-purple-900/20 pt-4">
            <span className="text-white">Total:</span>
            <span className="text-yellow-400">GH₵ {calculateTotal().toFixed(2)}</span>
          </div>

          {invalidItems.length > 0 && (
            <div className="p-3 rounded bg-red-900/20 border border-red-700 text-red-100 text-sm">
              {invalidItems.length} item{invalidItems.length > 1 ? 's' : ''} below minimum: {invalidItems.map(i => i.title).join(', ')}. Please update the amounts before proceeding.
            </div>
          )}

          <Button
            onClick={handleCheckout}
            disabled={isProcessing || invalidItems.length > 0}
            className={`w-full mt-4 text-lg py-6 ${invalidItems.length > 0 ? 'opacity-60 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'}`}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            {isProcessing ? "Processing..." : "Proceed to Checkout"}
          </Button>
        </div>
      </Card>
      {/* Confirm removal modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (pendingRemoval) {
            await removeFromCart(pendingRemoval.id, pendingRemoval.type);
          }
          setConfirmOpen(false);
          setPendingRemoval(null);
        }}
        title="Remove item from cart?"
        description={pendingRemoval ? `Are you sure you want to remove "${pendingRemoval.title}" from your cart?` : ''}
        confirmText="Remove"
        cancelText="Cancel"
      />
    </div>
  );
}