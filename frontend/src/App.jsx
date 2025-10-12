import SongDetails from './pages/SongDetails.jsx';
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ImageViewerProvider } from './contexts/ImageViewerContext.jsx';
import Layout from './Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Albums from './pages/Albums.jsx';
import Videos from './pages/Videos.jsx';
import AlbumDetails from './pages/AlbumDetails.jsx';
import VideoDetails from './pages/VideoDetails.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import PurchaseSuccess from './pages/PurchaseSuccess.jsx';
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
import UploadSong from './pages/UploadSong.jsx';
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
        <Route path="/videos" element={withLayout(Videos, 'Videos')} />
        <Route path="/albums/:id" element={withLayout(AlbumDetails, 'AlbumDetails')} />
        <Route path="/videos/:id" element={withLayout(VideoDetails, 'VideoDetails')} />
  <Route path="/creators/:id" element={withLayout(Creator, 'Creator')} />
        <Route path="/cart" element={<ProtectedRoute>{withLayout(Cart, 'Cart')}</ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute>{withLayout(Checkout, 'Checkout')}</ProtectedRoute>} />
  <Route path="/purchase/success" element={<ProtectedRoute>{withLayout(PurchaseSuccess, 'Purchase Success')}</ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute>{withLayout(Library, 'Library')}</ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute>{withLayout(Admin, 'Admin')}</ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute>{withLayout(CreatorDashboard, 'Dashboard')}</ProtectedRoute>} />
  <Route path="/my/albums" element={<ProtectedRoute>{withLayout(MyAlbums, 'My Albums')}</ProtectedRoute>} />
  <Route path="/my/songs" element={<ProtectedRoute>{withLayout(MySongs, 'My Songs')}</ProtectedRoute>} />
  <Route path="/my/videos" element={<ProtectedRoute>{withLayout(MyVideos, 'My Videos')}</ProtectedRoute>} />
  <Route path="/profile" element={<ProtectedRoute>{withLayout(Profile, 'Profile')}</ProtectedRoute>} />
  <Route path="/upload/album" element={<ProtectedRoute>{withLayout(UploadAlbum, 'Upload Album')}</ProtectedRoute>} />
  <Route path="/upload/song" element={<ProtectedRoute>{withLayout(UploadSong, 'Upload Song')}</ProtectedRoute>} />
  <Route path="/upload/video" element={<ProtectedRoute>{withLayout(UploadVideo, 'Upload Video')}</ProtectedRoute>} />
        
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
