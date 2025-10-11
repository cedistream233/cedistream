import React, { useState, useEffect } from 'react';
import { Edit3 } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './dialog';

export const PriceEditModal = ({ 
  isOpen, 
  onClose, 
  currentPrice, 
  onSave, 
  loading = false,
  itemType = 'item' // 'album' or 'song'
}) => {
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPrice(String(currentPrice || '0'));
    }
  }, [isOpen, currentPrice]);

  const handleSave = () => {
    const parsed = parseFloat(price || '0');
    if (isNaN(parsed) || parsed < 0) return;
    onSave(parsed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleSave();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-purple-900/30 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-purple-400" />
            Update {itemType} price
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Set the minimum price for your {itemType}. Supporters can choose to pay more.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">GH₵</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-12 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0.00"
              autoFocus
              disabled={loading}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This is the minimum amount supporters must pay
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="border-slate-600 text-gray-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !price || isNaN(parseFloat(price)) || parseFloat(price) < 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </div>
            ) : (
              'Save Price'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const PriceDisplay = ({ 
  price, 
  onEdit, 
  canEdit = false, 
  optimisticPrice = null,
  loading = false 
}) => {
  const displayPrice = optimisticPrice !== null ? optimisticPrice : price;
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-semibold text-yellow-400">
        GH₵ {parseFloat(displayPrice ?? 0).toFixed(2)}
      </span>
      {loading && (
        <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      )}
      {canEdit && !loading && (
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Update
        </button>
      )}
    </div>
  );
};

export default PriceEditModal;