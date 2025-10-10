import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Song } from '@/entities/Song';
import { Card } from '@/components/ui/card';

export default function SongDetails() {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState(null);
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await Song.get(id);
      setSong(data);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      if (!song?.id) return;
      const token = localStorage.getItem('token');
      let full = null;
      if (token) full = await Song.getSignedUrl(song.id, token);
      if (full) {
        setPurchased(true);
        setAudioUrl(full);
        return;
      }
      const prev = await Song.getPreviewUrl(song.id);
      setPurchased(false);
      setAudioUrl(prev || null);
    })();
  }, [song?.id]);

  if (loading) return <div className="max-w-2xl mx-auto py-16 text-center text-gray-400">Loading…</div>;
  if (!song) return <div className="max-w-2xl mx-auto py-16 text-center text-gray-400">Song not found</div>;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card className="p-6 flex flex-col items-center gap-6">
        <img src={song.cover_image || 'https://via.placeholder.com/160?text=%F0%9F%8E%B5'} alt={song.title} className="w-40 h-40 rounded-lg object-cover mb-2" />
        <h1 className="text-2xl font-bold text-white mb-1">{song.title}</h1>
        <div className="text-gray-400 mb-2">{song.artist}</div>
        <audio controls src={audioUrl || undefined} className="w-full mb-2">
          Your browser does not support the audio element.
        </audio>
        {!audioUrl && (
          <div className="text-xs text-gray-400">No preview available. Purchase to listen.</div>
        )}
        <div className="text-yellow-400 font-bold text-lg">GH₵ {parseFloat(song.price)?.toFixed(2) || '0.00'}</div>
        {song.description && <div className="text-gray-300 mt-2">{song.description}</div>}
      </Card>
    </div>
  );
}
