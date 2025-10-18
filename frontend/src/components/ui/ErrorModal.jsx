import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ErrorModal({ 
  isOpen, 
  onClose, 
  title = 'Error', 
  error, 
  description,
  actionText = 'Try Again',
  onAction,
  showAction = true
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="z-60 bg-slate-900 border-slate-700 text-white sm:max-w-md">
        <DialogHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20"
          >
            <XCircle className="h-8 w-8 text-red-400" />
          </motion.div>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-gray-400 mt-2">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {error && (
          <div className="bg-red-500/10 border border-red-600/30 rounded-lg p-4 mt-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 break-words">{error}</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
          <Button 
            variant="secondary" 
            onClick={onClose} 
            className="border-slate-600 hover:bg-slate-800"
          >
            Close
          </Button>
          {showAction && onAction && (
            <Button 
              onClick={() => {
                onClose();
                onAction();
              }} 
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {actionText}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
