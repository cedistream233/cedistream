# Backblaze Bucket Setup for CediStream

## Step 1: Verify Your Buckets Are Public

In your Backblaze account, make sure these buckets are set to **Public**:

1. `cedistream-album-covers` - Public ✓
2. `cedistream-audio-files` - Public ✓ (or Private if you want auth-only access)
3. `cedistream-media` - Not currently used (can be ignored)
4. `cedistream-previews` - Public ✓ (previews should be public)
5. `cedistream-profiles` - Public ✓
6. `cedistream-promotions` - Public ✓
7. `cedistream-video-files` - Public ✓ (or Private if you want auth-only access)
8. `cedistream-video-thumbnails` - Public ✓

To change a bucket to Public:
- Go to Backblaze B2 > Buckets
- Click on the bucket name
- Under "Files in Bucket are:" select **Public**
- Click "Update Bucket"

## Step 2: Set Your Environment Variables

Add these to your `.env` file (EXACT bucket names):

```env
# Backblaze Credentials
BACKBLAZE_ACCOUNT_ID=your_account_id
BACKBLAZE_APPLICATION_KEY=your_application_key

# Physical Bucket Mappings (must match your Backblaze bucket names EXACTLY)
BACKBLAZE_BUCKET_MEDIA=cedistream-audio-files
BACKBLAZE_BUCKET_VIDEOS=cedistream-video-files
BACKBLAZE_BUCKET_PREVIEWS=cedistream-previews
BACKBLAZE_BUCKET_THUMBNAILS=cedistream-video-thumbnails
BACKBLAZE_BUCKET_ALBUMS=cedistream-album-covers
BACKBLAZE_BUCKET_PROFILES=cedistream-profiles
BACKBLAZE_BUCKET_PROMOTIONS=cedistream-promotions

# App URL (required for stream URLs)
APP_URL=https://your-api-url.com

# Optional: Public base URL
# BACKBLAZE_PUBLIC_BASE=https://f003.backblazeb2.com/file
```

## Step 3: How Files Are Organized

### Songs (standalone)
- Audio: `cedistream-audio-files/songs/{userId}/{timestamp}-{random}.mp3`
- Cover: `cedistream-album-covers/covers/{userId}/{timestamp}-{random}.jpg`
- Preview: `cedistream-previews/previews/{userId}/{timestamp}-{random}.mp3`

### Albums
- Cover: `cedistream-album-covers/album-covers/{userId}/{timestamp}-{random}.jpg`
- Song Audio: `cedistream-audio-files/albums/{userId}/{albumId}/songs/{timestamp}-{random}.mp3`
- Song Preview: `cedistream-previews/albums/{userId}/{albumId}/previews/{timestamp}-{random}.mp3`

### Videos
- Video: `cedistream-video-files/videos/{userId}/{timestamp}-{random}.mp4`
- Thumbnail: `cedistream-video-thumbnails/thumbnails/{userId}/{timestamp}-{random}.jpg`
- Preview: `cedistream-previews/videos/{userId}/{timestamp}-{random}-preview.mp4`

### Profiles
- Profile Image: `cedistream-profiles/profiles/{userId}/{timestamp}.jpg`

### Promotions
- Promotion Image: `cedistream-promotions/promotions/{userId}/{timestamp}-{random}.jpg`

## Step 4: Troubleshooting

### If uploads go to the wrong bucket:
- Check that your `.env` file has the EXACT bucket names
- Restart the backend after changing `.env`
- Enable debug mode: `BACKBLAZE_DEBUG=true` to see bucket mapping in logs

### If you can't see images/covers:
- Verify the bucket is set to **Public** in Backblaze
- Check the URL in the database matches the Backblaze URL format
- Test the URL directly in your browser

### If you can't play songs/videos:
- For public buckets: URLs should work directly
- For private buckets: The app will stream through `/api/media/stream/:bucket/:path`
- Check browser console for errors

## Step 5: Production Checklist

- [ ] All bucket names in `.env` match Backblaze EXACTLY
- [ ] Buckets are set to Public (or Private if you want auth-required playback)
- [ ] APP_URL is set to your production API domain
- [ ] BACKBLAZE_DEBUG is set to false (or removed)
- [ ] Backend has been restarted after .env changes
- [ ] Test upload: song with cover image
- [ ] Test playback: play the uploaded song
- [ ] Test image display: verify cover image shows in UI
