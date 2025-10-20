import React from 'react';
import ContentCard from '@/components/content/ContentCard';

export default function ContentRow({ item, type = 'song', onAddToCart, onViewDetails, showPwyw = true }) {
  // Map row props to ContentCard shape and render as a mobileRow so songs match videos appearance on mobile
  const cardItem = {
    ...item,
    cover_image: item.cover_image || item.thumbnail || null,
    artist: item.artist || item.creator || item.uploader || null,
    release_date: item.release_date || item.published_at || item.created_at || null,
  };

  return (
    <ContentCard
      item={cardItem}
      type={type}
      mobileRow={true}
      onAddToCart={onAddToCart}
      onViewDetails={onViewDetails}
      showPwyw={showPwyw}
    />
  );
}
