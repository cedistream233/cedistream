import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Ensure all relative `/api/*` requests go to the backend URL in production
import './utils/patchFetch.js';
import './index.css';
import App from './App.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
