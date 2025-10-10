import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Button } from './button';
import { CheckCircle2, Share2, ExternalLink } from 'lucide-react';

export default function PublishSuccessModal({ open, onClose, title='Published!', message='Your content is now live.', onView, onShare }) {
  return (
    <Dialog open={open}>
      <DialogContent className="bg-slate-900 text-white border border-green-900/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="w-5 h-5"/>
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-300">{message}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex gap-3">
          {onView && (
            <Button onClick={onView} className="bg-purple-600 hover:bg-purple-700">
              <ExternalLink className="w-4 h-4 mr-2"/> View
            </Button>
          )}
          {onShare && (
            <Button onClick={onShare} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
              <Share2 className="w-4 h-4 mr-2"/> Share
            </Button>
          )}
          {onClose && (
            <Button onClick={onClose} variant="ghost" className="ml-auto">Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
