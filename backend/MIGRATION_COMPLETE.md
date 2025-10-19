# CediStream Backblaze Migration - Complete Fix

## What Was Fixed

### 1. Bucket Routing Issues
**Problem**: All files were going to `cedistream-audio-files` regardless of type.

**Solution**: Implemented proper logical-to-physical bucket mapping:
- `'media'` → `BACKBLAZE_BUCKET_MEDIA` → `cedistream-audio-files`
- `'previews'` → `BACKBLAZE_BUCKET_PREVIEWS` → `cedistream-previews`
- `'albums'` → `BACKBLAZE_BUCKET_ALBUMS` → `cedistream-album-covers`
- `'videos'` → `BACKBLAZE_BUCKET_VIDEOS` → `cedistream-video-files`
- `'thumbnails'` → `BACKBLAZE_BUCKET_THUMBNAILS` → `cedistream-video-thumbnails`
- `'profiles'` → `BACKBLAZE_BUCKET_PROFILES` → `cedistream-profiles`
- `'promotions'` → `BACKBLAZE_BUCKET_PROMOTIONS` → `cedistream-promotions`

### 2. Simplified Upload Code
**Changed**: All upload routes now use simple logical bucket names like `'media'`, `'previews'`, `'albums'` instead of complex env fallback chains.

**Benefits**:
- Easier to read and maintain
- Consistent bucket routing
- Single source of truth (bucket mapping in `backblaze.js`)

### 3. File Organization

#### Songs
```
Audio:   cedistream-audio-files/songs/{userId}/{file}.mp3
Cover:   cedistream-album-covers/covers/{userId}/{file}.jpg
Preview: cedistream-previews/previews/{userId}/{file}.mp3
```

#### Albums
```
Cover:        cedistream-album-covers/album-covers/{userId}/{file}.jpg
Song Audio:   cedistream-audio-files/albums/{userId}/{albumId}/songs/{file}.mp3
Song Preview: cedistream-previews/albums/{userId}/{albumId}/previews/{file}.mp3
```

#### Videos
```
Video:     cedistream-video-files/videos/{userId}/{file}.mp4
Thumbnail: cedistream-video-thumbnails/thumbnails/{userId}/{file}.jpg
Preview:   cedistream-previews/videos/{userId}/{file}-preview.mp4
```

## Required Environment Variables

Add these to your `.env` file with EXACT bucket names:

```env
# Credentials
BACKBLAZE_ACCOUNT_ID=your_account_id
BACKBLAZE_APPLICATION_KEY=your_app_key

# Bucket Mappings (MUST match Backblaze exactly)
BACKBLAZE_BUCKET_MEDIA=cedistream-audio-files
BACKBLAZE_BUCKET_VIDEOS=cedistream-video-files
BACKBLAZE_BUCKET_PREVIEWS=cedistream-previews
BACKBLAZE_BUCKET_THUMBNAILS=cedistream-video-thumbnails
BACKBLAZE_BUCKET_ALBUMS=cedistream-album-covers
BACKBLAZE_BUCKET_PROFILES=cedistream-profiles
BACKBLAZE_BUCKET_PROMOTIONS=cedistream-promotions

# App URL (for stream URLs)
APP_URL=https://your-api.com

# Optional
BACKBLAZE_DEBUG=true  # Set to false in production
```

## Testing Steps

1. **Restart the backend** (already done)

2. **Upload a song with cover**:
   - Audio should go to: `cedistream-audio-files/songs/...`
   - Cover should go to: `cedistream-album-covers/covers/...`
   - Preview should go to: `cedistream-previews/previews/...`

3. **Check Backblaze**:
   - Browse each bucket in Backblaze web interface
   - Verify files are in the correct buckets

4. **Test playback**:
   - For public buckets: URLs work directly
   - For private buckets: Streamed through `/api/media/stream/...`

5. **Verify images load**:
   - Cover images should display in the UI
   - Check browser network tab for 404s

## Debug Mode

Enable to see bucket mapping in logs:
```env
BACKBLAZE_DEBUG=true
```

Logs will show:
```
[Backblaze] Bucket mapping configuration:
  MEDIA -> cedistream-audio-files
  PREVIEWS -> cedistream-previews
  ALBUMS -> cedistream-album-covers
  ...
[Backblaze] Resolved 'media' -> 'cedistream-audio-files'
```

## Production Notes

- Set all buckets to **Public** in Backblaze (unless you want auth-required playback)
- Set `BACKBLAZE_DEBUG=false` in production
- Ensure `APP_URL` is your production API domain
- Test thoroughly before deploying

## Files Changed

1. `backend/src/lib/backblaze.js` - Added debug logging and clearer bucket resolution
2. `backend/src/routes/uploads.js` - Simplified to use logical bucket names
3. `backend/src/routes/auth.js` - Updated to use logical 'profiles' bucket
4. `backend/src/routes/promotionsAdmin.js` - Updated to use logical 'promotions' bucket
5. `backend/src/server.js` - Updated expired promotions cleanup
6. `backend/src/lib/supabase.js` - Made Supabase package optional

## Why It Works Now

1. **Single Source of Truth**: Bucket mapping is centralized in `backblaze.js`
2. **Logical Names**: Code uses simple names ('media', 'previews') everywhere
3. **Physical Mapping**: Environment variables map logical → physical buckets
4. **Clear Organization**: Files are organized by type and user, easy to browse in Backblaze
5. **Debug Support**: Can see exactly what's happening with BACKBLAZE_DEBUG=true

## If Something Still Doesn't Work

1. Check `.env` file has EXACT bucket names (case-sensitive)
2. Restart backend after changing `.env`
3. Enable `BACKBLAZE_DEBUG=true` and check logs
4. Verify buckets are Public in Backblaze
5. Check browser console for errors
6. Test URLs directly in browser
