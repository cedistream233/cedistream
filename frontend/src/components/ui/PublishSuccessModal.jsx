import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Button } from './button';
import { CheckCircle2, Share2, ExternalLink } from 'lucide-react';

export default function PublishSuccessModal({ open, onClose, title='Published!', message='Your content is now live.', onView, onShare, created = null, onManage, onUploadAnother, compact = false }) {
  const url = created?.id ? `${window.location.origin}/${created.type === 'video' ? `videos/${created.id}` : created.type === 'song' ? `songs/${created.id}` : `albums/${created.id}`}` : null;
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

        {!compact && created ? (
          <div className="mt-3 flex gap-3 items-center">
            <div className="w-20 h-12 rounded overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700">
              {created.thumbnail ? <img src={created.thumbnail} className="w-full h-full object-cover" alt="thumb"/> : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{created.title || created.name || 'Untitled'}</div>
              <div className="text-xs text-gray-400 mt-1 truncate">{created.status || 'published'}</div>
              {url && <div className="text-xs text-slate-500 mt-1 truncate">{url}</div>}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex gap-3">
          {compact ? (
            // compact mode: show only the original simple actions (View, Share, Close)
            <>
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
            </>
          ) : (
            // full mode with manage/uploadanother options
            <>
              {onManage && (
                <Button onClick={onManage} className="bg-purple-600 hover:bg-purple-700">
                  <ExternalLink className="w-4 h-4 mr-2"/> Go to My Content
                </Button>
              )}

              {onView && (
                <Button onClick={onView} className="bg-slate-700 hover:bg-slate-800">
                  <ExternalLink className="w-4 h-4 mr-2"/> Open Public View
                </Button>
              )}

              {onShare && (
                <Button onClick={onShare} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
                  <Share2 className="w-4 h-4 mr-2"/> Share
                </Button>
              )}

              {onUploadAnother && (
                <Button onClick={onUploadAnother} variant="ghost" className="ml-auto">Upload another</Button>
              )}

              {onClose && !onUploadAnother && (
                <Button onClick={onClose} variant="ghost" className="ml-auto">Close</Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
