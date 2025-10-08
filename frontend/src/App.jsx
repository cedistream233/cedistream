import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout.jsx';
import Home from './pages/Home.jsx';
import Albums from './pages/Albums.jsx';
import Videos from './pages/Videos.jsx';
import AlbumDetails from './pages/AlbumDetails.jsx';
import VideoDetails from './pages/VideoDetails.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Library from './pages/Library.jsx';
import Admin from './pages/Admin.jsx';

const withLayout = (Component, name) => (
  <Layout currentPageName={name}>
    <Component />
  </Layout>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={withLayout(Home, 'Home')} />
      <Route path="/albums" element={withLayout(Albums, 'Albums')} />
      <Route path="/videos" element={withLayout(Videos, 'Videos')} />
      <Route path="/albums/:id" element={withLayout(AlbumDetails, 'AlbumDetails')} />
      <Route path="/videos/:id" element={withLayout(VideoDetails, 'VideoDetails')} />
      <Route path="/cart" element={withLayout(Cart, 'Cart')} />
      <Route path="/checkout" element={withLayout(Checkout, 'Checkout')} />
      <Route path="/library" element={withLayout(Library, 'Library')} />
      <Route path="/admin" element={withLayout(Admin, 'Admin')} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
