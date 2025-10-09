import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';

export default function ImageViewerModal({ isOpen, onClose, imageUrl }) {
  return (
    <Dialog open={!!isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-2xl bg-white text-slate-900 border border-slate-200">
        <div className="flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Preview"
              className="max-h-[70vh] w-full h-auto object-contain rounded-lg"
            />
          ) : (
            <div className="h-64 w-full flex items-center justify-center text-gray-400">No image</div>
          )}
        </div>
        <DialogFooter className="w-full flex justify-center">
          <Button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
