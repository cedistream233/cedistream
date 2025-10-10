import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';

export default function UploadProgressModal({ open, title='Uploading…', description='Please wait while your files upload. Do not close this page.', percent=0 }) {
  return (
    <Dialog open={open}>
      <DialogContent className="bg-slate-900 text-white border border-purple-900/30">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-gray-400">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${Math.min(100, Math.max(0, Math.floor(percent)))||0}%` }} />
          </div>
          <div className="text-sm text-gray-300 mt-2">{Math.floor(percent) || 0}%</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
