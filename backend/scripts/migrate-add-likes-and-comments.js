#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../src/lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  console.log('🔄 Running likes and comments migration...');
  
  try {
    const sql = readFileSync(
      join(__dirname, '../database/add_likes_and_comments.sql'),
      'utf-8'
    );

    await query(sql);
    
    console.log('✅ Likes and comments migration completed successfully!');
    console.log('📊 Created tables: likes, comments');
    console.log('📊 Created views: content_like_counts, content_comment_counts');
    console.log('🔍 Created indexes for optimal performance');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
