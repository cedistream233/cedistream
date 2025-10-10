import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getCroppedImg } from '@/utils/crop';

export default function CropperModal({ isOpen, onClose, file, onConfirm, aspect = 1, title = 'Crop Image', description = 'Drag to position and use zoom to adjust framing.' }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const handleCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!file || !croppedAreaPixels) return onClose();
    try {
      const blob = await getCroppedImg(URL.createObjectURL(file), croppedAreaPixels, rotation);
      await onConfirm(blob);
    } catch (e) {
      console.error('Crop error', e);
    }
    onClose();
  };

  return (
    <Dialog open={!!isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-2xl">
        <DialogHeader className="text-center">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-gray-400">{description}</DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-96 bg-slate-800 mt-4">
          {file && (
            <Cropper
              image={URL.createObjectURL(file)}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-gray-300">Zoom</label>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0 mt-4">
          <Button variant="secondary" onClick={onClose} className="border-slate-600 hover:bg-slate-800">Cancel</Button>
          <Button onClick={handleConfirm} className="bg-purple-600 hover:bg-purple-700">Crop & Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
