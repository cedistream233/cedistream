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
import { LogOut, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LogoutConfirmModal({ isOpen, onClose, onConfirm, userName }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirm = async () => {
    setIsLoggingOut(true);
    await onConfirm();
    setIsLoggingOut(false);
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
          <DialogTitle className="text-xl font-semibold">
            Confirm Logout
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {userName ? (
              <>Are you sure you want to sign out, <span className="font-medium text-white">{userName}</span>?</>
            ) : (
              'Are you sure you want to sign out?'
            )}
            <br />
            You'll need to sign in again to access your account.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoggingOut}
            className="border-slate-600 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoggingOut}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoggingOut ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing out...
              </div>
            ) : (
              <div className="flex items-center">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}