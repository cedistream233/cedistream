import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop({ top = 0 }) {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      // smooth behavior could be undesirable in some cases, use instant for navigation
      window.scrollTo({ top, left: 0, behavior: 'auto' });
    } catch (e) {
      // fallback
      window.scrollTo(0, top);
    }
  }, [pathname, top]);

  return null;
}
