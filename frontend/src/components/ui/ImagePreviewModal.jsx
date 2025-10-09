import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';

export default function ImagePreviewModal({ isOpen, onClose, file, imageUrl, onConfirm }) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (imageUrl) {
      setPreviewUrl(imageUrl);
      return;
    }
    setPreviewUrl('');
    return;
  }, [file, imageUrl]);

  const handleConfirm = async () => {
    if (!onConfirm) return onClose();
    await onConfirm(file);
    onClose();
  };

  return (
    <Dialog open={!!isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-lg">
        <DialogHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-600/20"
          >
            <div className="h-10 w-10 rounded-full bg-purple-500/30" />
          </motion.div>
          <DialogTitle className="text-xl font-semibold">Preview Profile Image</DialogTitle>
          <DialogDescription className="text-gray-400">Make sure the face is centered and visible. Confirm to upload.</DialogDescription>
        </DialogHeader>

        <div className="my-4 flex items-center justify-center">
          {previewUrl ? (
            <div className="w-72 h-72 rounded-full overflow-hidden border border-slate-700 bg-slate-800">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-72 h-72 rounded-full flex items-center justify-center border border-slate-700 text-gray-400">No image</div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
          <Button variant="secondary" onClick={onClose} className="border-slate-600 hover:bg-slate-800">Cancel</Button>
          <Button onClick={handleConfirm} className="bg-purple-600 hover:bg-purple-700">Upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
