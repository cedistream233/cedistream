import React, { createContext, useContext, useState, useCallback } from 'react';
import ImageViewerModal from '@/components/ui/ImageViewerModal';

const ImageViewerCtx = createContext({ open: () => {}, close: () => {} });

export function ImageViewerProvider({ children }) {
  const [imageUrl, setImageUrl] = useState(null);
  const open = useCallback((url) => setImageUrl(url || null), []);
  const close = useCallback(() => setImageUrl(null), []);

  return (
    <ImageViewerCtx.Provider value={{ open, close }}>
      {children}
      <ImageViewerModal isOpen={!!imageUrl} onClose={close} imageUrl={imageUrl} />
    </ImageViewerCtx.Provider>
  );
}

export function useImageViewer() {
  return useContext(ImageViewerCtx);
}
