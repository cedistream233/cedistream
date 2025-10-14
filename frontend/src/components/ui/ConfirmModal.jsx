import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title = 'Confirm', description, confirmText = 'Confirm', cancelText = 'Cancel', children = null }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
        <DialogHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20"
          >
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </motion.div>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          {description && <DialogDescription className="text-gray-400">{description}</DialogDescription>}
        </DialogHeader>

        {/* Allow callers to inject extra content (e.g. notes input) */}
        {children}

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
          <Button variant="secondary" onClick={onClose} disabled={loading} className="border-slate-600 hover:bg-slate-800">
            {cancelText}
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
            {loading ? 'Working...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
