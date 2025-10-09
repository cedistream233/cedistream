-- Sample users and updated seed data for CediStream
-- Run this after users migration

-- Insert sample users (passwords are 'password123' hashed with bcrypt)
INSERT INTO users (email, password_hash, first_name, last_name, role, bio, is_verified) VALUES
('kwame@beats.com', '$2b$10$rOJ3aQVb5gF9FJ9V9V9V9O9V9V9V9V9V9V9V9V9V9V9V9V9V9V9V9u', 'Kwame', 'Beats', 'creator', 'Afrobeats producer and artist from Accra', true),
('faith@singers.com', '$2b$10$rOJ3aQVb5gF9FJ9V9V9V9O9V9V9V9V9V9V9V9V9V9V9V9V9V9V9V9u', 'Faith', 'Singers', 'creator', 'Gospel music group spreading joy through worship', true),
('legends@highlife.com', '$2b$10$rOJ3aQVb5gF9FJ9V9V9V9O9V9V9V9V9V9V9V9V9V9V9V9V9V9V9V9u', 'The', 'Legends', 'creator', 'Preserving authentic Ghanaian Highlife music', true),
('supporter@demo.com', '$2b$10$rOJ3aQVb5gF9FJ9V9V9V9O9V9V9V9V9V9V9V9V9V9V9V9V9V9V9V9u', 'Demo', 'User', 'supporter', 'Music lover and supporter of local artists', false);

-- Insert creator profiles
INSERT INTO creator_profiles (user_id, stage_name, genre_specialties, social_media, bank_account_name, bank_name, total_earnings, total_sales) VALUES
((SELECT id FROM users WHERE email = 'kwame@beats.com'), 'Kwame Beats', ARRAY['Afrobeats', 'Hip Hop'], '{"instagram": "@kwamebeats", "twitter": "@kwamebeats"}', 'Kwame Beats Music', 'GCB Bank', 2500.00, 15),
((SELECT id FROM users WHERE email = 'faith@singers.com'), 'Faith Singers', ARRAY['Gospel', 'Contemporary'], '{"youtube": "FaithSingersGH"}', 'Faith Ministry Account', 'Ecobank', 1800.00, 12),
((SELECT id FROM users WHERE email = 'legends@highlife.com'), 'The Legends', ARRAY['Highlife', 'Traditional'], '{"facebook": "HighlifeLegends"}', 'Legends Music Group', 'Absa Bank', 3200.00, 8);

-- Update albums with user_id
UPDATE albums SET user_id = (SELECT id FROM users WHERE email = 'kwame@beats.com') WHERE title = 'Afro Vibes';
UPDATE albums SET user_id = (SELECT id FROM users WHERE email = 'faith@singers.com') WHERE title = 'Gospel Praise';
UPDATE albums SET user_id = (SELECT id FROM users WHERE email = 'legends@highlife.com') WHERE title = 'Highlife Classics';

-- Update videos with user_id
UPDATE videos SET user_id = (SELECT id FROM users WHERE email = 'kwame@beats.com') WHERE title IN ('Behind the Music', 'Accra Nights - Music Video');
UPDATE videos SET user_id = (SELECT id FROM users WHERE email = 'kwame@beats.com') WHERE title = 'Dance Tutorial: Azonto Moves';

-- Update purchases with user_id
UPDATE purchases SET user_id = (SELECT id FROM users WHERE email = 'supporter@demo.com');