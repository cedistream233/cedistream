import SongDetails from './pages/SongDetails.jsx';
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ImageViewerProvider } from './contexts/ImageViewerContext.jsx';
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
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import CreatorDashboard from './pages/CreatorDashboard.jsx';
import Profile from './pages/Profile.jsx';
import Creator from './pages/Creator.jsx';
import UploadAlbum from './pages/UploadAlbum.jsx';
import UploadVideo from './pages/UploadVideo.jsx';
import MyAlbums from './pages/MyAlbums.jsx';
import MySongs from './pages/MySongs.jsx';
import MyVideos from './pages/MyVideos.jsx';

const withLayout = (Component, name) => (
  <Layout currentPageName={name}>
    <Component />
  </Layout>
);

export default function App() {
  return (
    <AuthProvider>
      <ImageViewerProvider>
        <Routes>
        <Route path="/" element={withLayout(Home, 'Home')} />
  <Route path="/albums" element={withLayout(Albums, 'Albums')} />
  <Route path="/songs" element={withLayout(Albums, 'Songs')} />
  <Route path="/songs/:id" element={withLayout(SongDetails, 'SongDetails')} />
  <Route path="/songs" element={withLayout(Albums, 'Songs')} />
        <Route path="/videos" element={withLayout(Videos, 'Videos')} />
        <Route path="/albums/:id" element={withLayout(AlbumDetails, 'AlbumDetails')} />
        <Route path="/videos/:id" element={withLayout(VideoDetails, 'VideoDetails')} />
  <Route path="/creators/:id" element={withLayout(Creator, 'Creator')} />
        <Route path="/cart" element={withLayout(Cart, 'Cart')} />
        <Route path="/checkout" element={withLayout(Checkout, 'Checkout')} />
        <Route path="/library" element={withLayout(Library, 'Library')} />
        <Route path="/admin" element={withLayout(Admin, 'Admin')} />
        <Route path="/dashboard" element={withLayout(CreatorDashboard, 'Dashboard')} />
  <Route path="/my/albums" element={withLayout(MyAlbums, 'My Albums')} />
  <Route path="/my/songs" element={withLayout(MySongs, 'My Songs')} />
  <Route path="/my/videos" element={withLayout(MyVideos, 'My Videos')} />
  <Route path="/profile" element={withLayout(Profile, 'Profile')} />
    <Route path="/upload/album" element={withLayout(UploadAlbum, 'Upload Album')} />
    <Route path="/upload/video" element={withLayout(UploadVideo, 'Upload Video')} />
        
        {/* Auth routes without layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ImageViewerProvider>
    </AuthProvider>
  );
}
