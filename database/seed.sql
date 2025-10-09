-- Sample data for CediStream (based on Base44 data)
-- Run this after creating the schema

-- Insert Albums
INSERT INTO albums (title, artist, description, price, cover_image, release_date, genre, songs) VALUES
('Afro Vibes', 'Kwame Beats', 'The hottest Afrobeats collection of the year', 25.00, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80', '2024-01-15', 'Afrobeats', '[
    {"title":"Dance All Night","duration":"3:45","audio_url":null},
    {"title":"Summer Vibes","duration":"4:20","audio_url":null},
    {"title":"Love & Light","duration":"3:30","audio_url":null}
]'::jsonb),

('Gospel Praise', 'Faith Singers', 'Uplifting worship songs for your soul', 20.00, 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80', '2024-02-01', 'Gospel', '[
    {"title":"Amazing Grace","duration":"4:10","audio_url":null},
    {"title":"Hallelujah","duration":"3:55","audio_url":null}
]'::jsonb),

('Highlife Classics', 'The Legends', 'Timeless Highlife music from Ghana', 30.00, 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80', '2023-12-10', 'Highlife', '[]'::jsonb);

-- Insert Videos
INSERT INTO videos (title, creator, description, price, thumbnail, video_url, duration, category, release_date) VALUES
('Behind the Music', 'Studio Sessions', 'Exclusive documentary on the making of Afro Vibes', 15.00, 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80', null, '45:00', 'Documentary', '2024-01-20'),

('Dance Tutorial: Azonto Moves', 'Dance Academy GH', 'Learn the best Azonto dance moves step by step', 10.00, 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&q=80', null, '25:30', 'Tutorial', '2024-02-05'),

('Accra Nights - Music Video', 'Kwame Beats', 'Official music video for the hit single', 12.00, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80', null, '4:15', 'Music Video', '2024-01-25');

-- Insert Sample Purchases (you can update with real UUIDs after albums/videos are created)
-- Note: Replace the item_id values with actual UUIDs from your albums/videos tables
INSERT INTO purchases (user_email, item_type, item_id, item_title, amount, payment_status, payment_reference, payment_method) VALUES
('demo@example.com', 'video', (SELECT id FROM videos WHERE title = 'Behind the Music' LIMIT 1), 'Behind the Music', 15.00, 'pending', null, null),
('demo@example.com', 'album', (SELECT id FROM albums WHERE title = 'Afro Vibes' LIMIT 1), 'Afro Vibes', 25.00, 'pending', null, null);