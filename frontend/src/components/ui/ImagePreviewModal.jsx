import React, { useState, useEffect, useRef } from 'react';
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

export default function ImagePreviewModal({ isOpen, onClose, file, imageUrl, onConfirm, title = 'Preview Image', outputSize = 600 }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const imgWrapRef = useRef(null);
  const imgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

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

  useEffect(() => {
    // reset zoom/offset when preview changes
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [previewUrl]);

  const handleConfirm = async () => {
    if (!onConfirm) return onClose();
    // Compute transform params in pixels relative to preview container center
    // preview container size in DOM
    const wrap = imgWrapRef.current;
    const rect = wrap ? wrap.getBoundingClientRect() : { width: 280, height: 280 };
    // offset.x/y already represent pixels moved via dragging in the preview coordinates used
    const params = { zoom, offset: { x: offset.x, y: offset.y }, outputSize };
    await onConfirm(file, params);
    onClose();
  };

  const startDrag = (e) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX || (e.touches && e.touches[0].clientX), y: e.clientY || (e.touches && e.touches[0].clientY) };
  };
  const endDrag = () => { dragging.current = false; };
  const onMove = (e) => {
    if (!dragging.current) return;
    const cx = e.clientX || (e.touches && e.touches[0].clientX);
    const cy = e.clientY || (e.touches && e.touches[0].clientY);
    const dx = cx - lastPos.current.x;
    const dy = cy - lastPos.current.y;
    lastPos.current = { x: cx, y: cy };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };

  const resetTransform = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    dragging.current = false;
    lastPos.current = { x: 0, y: 0 };
    // trigger a reflow by briefly toggling previewUrl if needed (not necessary normally)
  };

  return (
    <Dialog open={!!isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-600/20"
          >
            <div className="h-10 w-10 rounded-full bg-purple-500/30" />
          </motion.div>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-gray-400">Adjust position and zoom then confirm to upload the edited image.</DialogDescription>
        </DialogHeader>

          <div className="my-4 flex flex-col sm:flex-row items-start gap-6">
            <div className="flex items-center justify-center w-full">
            {/* Responsive square crop: use viewport-relative sizing on small screens and fixed on larger */}
            <div
              ref={imgWrapRef}
              onMouseDown={startDrag}
              onMouseMove={onMove}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              onTouchStart={startDrag}
              onTouchMove={onMove}
              onTouchEnd={endDrag}
              className="mx-auto w-[min(84vw,320px)] h-[min(84vw,320px)] sm:w-96 sm:h-96 rounded overflow-hidden border border-slate-700 bg-slate-800 relative"
            >
              {previewUrl ? (
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Preview"
                  style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, touchAction: 'none' }}
                  className="block select-none pointer-events-none"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[240px]">
            <div className="mb-2 text-sm text-gray-300">Zoom</div>
            <input type="range" min="0.5" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
            <div className="mt-2 mb-4 text-sm text-gray-300">Position (drag image to move)</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={resetTransform}>Reset</Button>
              <div className="text-sm text-gray-400 mt-2">Use mouse/touch to reposition the image in the frame</div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-3 border-t border-slate-700 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
          <Button variant="secondary" onClick={onClose} className="border-slate-600 hover:bg-slate-800">Cancel</Button>
          <Button onClick={handleConfirm} className="bg-purple-600 hover:bg-purple-700">Upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
