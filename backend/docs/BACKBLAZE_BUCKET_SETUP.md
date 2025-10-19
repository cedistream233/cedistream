# Backblaze B2 Bucket Setup Guide

This guide helps you set up Backblaze B2 buckets to match your existing Supabase storage structure.

## Your Current Supabase Buckets

Based on your Supabase setup, you have these buckets:
- **Album-covers** (Public)
- **audio-files** (Private)
- **video-files** (Private)
- **profiles** (Public)
- **previews** (Public)
- **video-thumbnails** (Public)
- **promotions** (Public)

## Backblaze B2 Setup Steps

### 1. Create Application Key

1. Log in to your Backblaze account at https://secure.backblaze.com
2. Go to **App Keys** (under Account menu)
3. Click **Add a New Application Key**
4. Settings:
   - Key Name: `cedistream-production` (or your preferred name)
   - Allow access to Bucket(s): All
   - Type of Access: Read and Write
   - File name prefix: (leave empty for full access)
   - Duration: (leave empty for no expiration)
5. Click **Create New Key**
6. **IMPORTANT**: Copy and save:
   - **keyID** (this is your `BACKBLAZE_ACCOUNT_ID`)
   - **applicationKey** (this is your `BACKBLAZE_APPLICATION_KEY`)
   - You won't be able to see the applicationKey again!

### 2. Create Buckets

You have two main options:

#### Option A: Single Bucket (Recommended - Simpler)
Create one bucket and use folder paths to organize content:

1. Go to **Buckets** → **Create a Bucket**
2. Settings:
   - Bucket Name: `cedistream-media` (must be globally unique)
   - Files in Bucket are: **Public** (important for streaming)
   - Default Encryption: Disabled (or enabled if you prefer)
   - Object Lock: Disabled
3. Click **Create a Bucket**

With this approach, your folder structure will be:
```
cedistream-media/
  ├── albums/          (covers and songs)
  ├── songs/           (standalone songs)
  ├── videos/          (video files)
  ├── profiles/        (profile images)
  ├── previews/        (preview clips)
  ├── thumbnails/      (video thumbnails)
  └── promotions/      (promotional images)
```

**Environment Variables for Single Bucket:**
```env
BACKBLAZE_ACCOUNT_ID=your_key_id_here
BACKBLAZE_APPLICATION_KEY=your_app_key_here
BACKBLAZE_BUCKET_NAME=cedistream-media
BACKBLAZE_PUBLIC_BASE=https://f001.backblazeb2.com/file/cedistream-media
```

#### Option B: Multiple Buckets (Matches Supabase Structure)
Create separate buckets for each content type:

Create these 7 buckets:
1. `cedistream-albums` (Public) - for album covers
2. `cedistream-audio` (Public) - for audio files
3. `cedistream-videos` (Public) - for video files
4. `cedistream-profiles` (Public) - for profile images
5. `cedistream-previews` (Public) - for preview clips
6. `cedistream-thumbnails` (Public) - for video thumbnails
7. `cedistream-promotions` (Public) - for promotional images

**Environment Variables for Multiple Buckets:**
```env
BACKBLAZE_ACCOUNT_ID=your_key_id_here
BACKBLAZE_APPLICATION_KEY=your_app_key_here
BACKBLAZE_BUCKET_NAME=cedistream-media
# Map each Supabase bucket to B2 bucket
B2_BUCKET_ALBUMS=cedistream-albums
B2_BUCKET_MEDIA=cedistream-audio
B2_BUCKET_VIDEOS=cedistream-videos
B2_BUCKET_PROFILES=cedistream-profiles
B2_BUCKET_PREVIEWS=cedistream-previews
B2_BUCKET_THUMBNAILS=cedistream-thumbnails
B2_BUCKET_PROMOTIONS=cedistream-promotions
BACKBLAZE_PUBLIC_BASE=https://f001.backblazeb2.com/file
```

### 3. Configure Bucket Settings

For each bucket (if using multiple buckets):

1. Click on the bucket name
2. Go to **Bucket Settings**
3. Set **Bucket Info**:
   ```json
   {
     "Cache-Control": "max-age=3600"
   }
   ```
4. Configure **Lifecycle Rules** (optional - for automatic deletion of old files):
   - Days to keep: 365 (adjust as needed)
   - File name prefix: (leave empty to apply to all)

### 4. Enable CORS (Critical for Web Playback)

To allow your frontend to stream media directly from B2:

1. Go to bucket → **CORS Rules**
2. Add this rule:
```json
[
  {
    "corsRuleName": "allowCedistream",
    "allowedOrigins": [
      "https://cedistream.onrender.com",
      "http://localhost:3000",
      "http://localhost:5173"
    ],
    "allowedOperations": [
      "b2_download_file_by_id",
      "b2_download_file_by_name"
    ],
    "allowedHeaders": ["range", "authorization"],
    "exposeHeaders": ["content-length", "content-range", "accept-ranges"],
    "maxAgeSeconds": 3600
  }
]
```

### 5. Update Environment Variables

Add to your `.env` file (or Render dashboard):

```env
# Backblaze B2 Configuration
BACKBLAZE_ACCOUNT_ID=your_key_id_from_step_1
BACKBLAZE_APPLICATION_KEY=your_app_key_from_step_1
BACKBLAZE_BUCKET_NAME=cedistream-media

# Public URL base (adjust based on your bucket name)
BACKBLAZE_PUBLIC_BASE=https://f001.backblazeb2.com/file/cedistream-media

# Optional: Upload thresholds
BACKBLAZE_LARGE_UPLOAD_THRESHOLD_BYTES=52428800  # 50MB
BACKBLAZE_PART_SIZE=10485760                      # 10MB per part
```

### 6. Map Environment Variables in Code

The code already handles bucket mapping. Update these in your environment:

For all routes:
```env
BACKBLAZE_BUCKET_MEDIA=cedistream-audio-files
BACKBLAZE_BUCKET_VIDEOS=cedistream-video-files
BACKBLAZE_BUCKET_PREVIEWS=cedistream-previews
BACKBLAZE_BUCKET_THUMBNAILS=cedistream-video-thumbnails
BACKBLAZE_BUCKET_PROFILES=cedistream-profiles
BACKBLAZE_BUCKET_ALBUMS=cedistream-album-covers
BACKBLAZE_BUCKET_PROMOTIONS=cedistream-promotions
```

**Note**: The Backblaze client will use these bucket names to organize files within your single B2 bucket (Option A) or map to separate B2 buckets (Option B).

## Recommendation

**Use Option A (Single Bucket)** for simplicity:
- Easier to manage
- Single set of CORS rules
- Simpler billing and monitoring
- Your code already organizes files by path (albums/, videos/, etc.)

The backend code treats bucket names as logical namespaces. With Backblaze, you can use one physical bucket and rely on path-based organization.

## Testing Your Setup

After configuring:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables in `.env`

3. Start the backend:
   ```bash
   npm run dev
   ```

4. Test an upload via your frontend or Postman:
   - Upload a profile image
   - Upload a song or video
   - Verify the file appears in your B2 bucket

5. Test streaming:
   - Request a media URL via `/api/media/song/:id`
   - The returned URL should point to `/api/media/stream/...`
   - Open that URL with authentication header
   - Video/audio should stream with seek support

## Troubleshooting

### "Bucket not found" error
- Double-check `BACKBLAZE_BUCKET_NAME` matches your B2 bucket name exactly
- Verify your application key has access to that bucket

### CORS errors in browser
- Add your frontend domain to CORS rules
- Include `localhost` URLs for development

### Files upload but return 404 on stream
- Check that `BACKBLAZE_PUBLIC_BASE` is correct
- Verify bucket is set to **Public**
- Check file path in B2 dashboard matches expected path

### Large file uploads fail
- Increase `BACKBLAZE_LARGE_UPLOAD_THRESHOLD_BYTES`
- Ensure stable network connection
- Check B2 dashboard for partial uploads and clean them up

## Security Notes

1. **Never commit** `.env` file with real credentials
2. Use **environment variables** in production (Render secrets)
3. Set bucket to **Public** only if you need direct browser access
4. For private buckets, all access goes through `/api/media/stream` with auth
5. Rotate application keys periodically
6. Monitor B2 dashboard for unexpected usage

## Cost Considerations

Backblaze B2 Pricing (as of 2025):
- Storage: $0.005/GB/month (10GB = $0.05/month)
- Download: First 3x storage free, then $0.01/GB
- API calls: First 2,500/day free, then $0.004/10k calls

Example for 100GB of content + 1TB monthly downloads:
- Storage: $0.50/month
- Download: First 300GB free, then 700GB × $0.01 = $7/month
- **Total**: ~$7.50/month

Compare to Supabase: typically $25-50/month for similar usage.

## Support

For issues:
1. Check Backblaze B2 documentation: https://www.backblaze.com/b2/docs/
2. Review backend logs for error details
3. Test with B2 CLI: https://www.backblaze.com/b2/docs/quick_command_line.html
