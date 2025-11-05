import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { setPostAuthIntent } from '@/utils';
import { useNavigate } from 'react-router-dom';

// Prefer relative API by default (works when frontend and backend are served together).
// Use VITE_API_URL only when explicitly configured for cross-origin deployments.
const API_URL = (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) || '';

export default function LikeButton({ contentType, contentId, className = '' }) {
  const [likes, setLikes] = useState({ count: 0, userHasLiked: false });
  const [isLoading, setIsLoading] = useState(false);
  const [optimisticUpdate, setOptimisticUpdate] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadLikes();
  }, [contentType, contentId]);

  const loadLikes = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/api/likes/${contentType}/${contentId}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        setLikes(data);
      }
    } catch (error) {
      console.error('Failed to load likes:', error);
    }
  };

  const handleLike = async () => {
    if (!user) {
      // Redirect to login with intent to return
      setPostAuthIntent(window.location.pathname);
      navigate('/auth/login');
      return;
    }

    if (isLoading) return;

    // Optimistic update
    const newState = !likes.userHasLiked;
    const newCount = likes.count + (newState ? 1 : -1);
    setOptimisticUpdate({ count: newCount, userHasLiked: newState });
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const method = likes.userHasLiked ? 'DELETE' : 'POST';
      
      const response = await fetch(
        `${API_URL}/api/likes/${contentType}/${contentId}`,
        {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLikes(data);
        setOptimisticUpdate(null);
      } else if (response.status === 401) {
        // Token expired, redirect to login
        localStorage.removeItem('token');
        setPostAuthIntent(window.location.pathname);
        navigate('/auth/login');
      } else {
        // Revert optimistic update on error
        setOptimisticUpdate(null);
        const error = await response.json();
        console.error('Failed to toggle like:', error);
      }
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticUpdate(null);
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayData = optimisticUpdate || likes;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        onClick={handleLike}
        variant={displayData.userHasLiked ? "default" : "outline"}
        size="sm"
        className={`group transition-all duration-200 ${
          displayData.userHasLiked 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'hover:bg-red-50 hover:border-red-300'
        }`}
        disabled={isLoading}
      >
        <Heart
          className={`w-4 h-4 mr-1 transition-all duration-200 ${
            displayData.userHasLiked 
              ? 'fill-white' 
              : 'group-hover:fill-red-500 group-hover:text-red-500'
          } ${isLoading ? 'animate-pulse' : ''}`}
        />
        <span className={displayData.userHasLiked ? 'text-white' : 'group-hover:text-red-500'}>
          {displayData.count}
        </span>
      </Button>
    </div>
  );
}
