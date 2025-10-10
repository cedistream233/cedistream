import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChooseAmountModal({ visible, min = 0, initial = null, onCancel, onConfirm, title = 'Enter amount' }) {
  const [amount, setAmount] = useState(initial ?? min);

  useEffect(() => {
    if (visible) setAmount(initial ?? min);
  }, [visible, initial, min]);

  if (!visible) return null;

  const handleConfirm = () => {
    const val = Number(amount || 0) || 0;
    onConfirm(Math.max(min, val));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Card className="w-full max-w-md p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400">Minimum: GH₵ {Number(min || 0).toFixed(2)}</p>
        </div>
        <div className="mb-4">
          <Input type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} className="bg-slate-800 text-white" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} className="border-slate-700">Cancel</Button>
          <Button onClick={handleConfirm} className="bg-gradient-to-r from-purple-600 to-pink-600">Pay GH₵ {Number(amount||min).toFixed(2)}</Button>
        </div>
      </Card>
    </div>
  );
}
