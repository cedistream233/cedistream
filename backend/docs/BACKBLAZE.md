# Backblaze B2 Storage Integration

This project uses Backblaze B2 as a cost-effective, production-ready storage solution for media files (audio, video, images).

## Overview

The Backblaze B2 integration provides:
- ✅ **Large file support** - Multipart uploads for files > 50MB
- ✅ **Streaming with range requests** - Efficient video/audio playback with seek support
- ✅ **Authentication & authorization** - Server-side streaming endpoint with ownership verification
- ✅ **Cost-effective** - ~10x cheaper than Supabase storage
- ✅ **Production-ready** - Retry logic, error handling, CORS support

## Quick Start

### 1. Set Up Backblaze Account & Buckets

See **[BACKBLAZE_BUCKET_SETUP.md](./BACKBLAZE_BUCKET_SETUP.md)** for detailed instructions on:
- Creating application keys
- Setting up buckets (single bucket vs. multiple buckets)
- Configuring CORS rules
- Cost estimates

### 2. Configure Environment Variables

Add these to your `.env` file or deployment environment (e.g., Render):

```env
# Required
BACKBLAZE_ACCOUNT_ID=your_key_id
BACKBLAZE_APPLICATION_KEY=your_app_key
BACKBLAZE_BUCKET_NAME=cedistream-media

# Recommended
BACKBLAZE_PUBLIC_BASE=https://f001.backblazeb2.com/file/cedistream-media

# Optional
BACKBLAZE_LARGE_UPLOAD_THRESHOLD_BYTES=52428800  # 50MB - files larger use multipart
BACKBLAZE_PART_SIZE=10485760                      # 10MB per part for large uploads
```

### 3. Install Dependencies

```bash
cd backend
npm install
```

### 4. Test

Start the backend and test an upload:

```bash
npm run dev
```

## How It Works

### Upload Flow

1. Client uploads file via `/api/uploads/songs`, `/api/uploads/videos`, etc.
2. Backend determines file size:
   - **Small files** (< 50MB): Direct upload to B2
   - **Large files** (≥ 50MB): Multipart upload using B2 large file APIs
3. Public URL is generated and stored in database
4. File is available for streaming

### Streaming Flow (Private Content)

1. Client requests media URL: `GET /api/media/song/:id` (with auth token)
2. Backend verifies:
   - User is authenticated
   - User owns the content OR has purchased it
3. Backend returns streaming URL: `/api/media/stream/:bucket/:encodedPath`
4. Client streams from that URL (with auth token in header)
5. Backend verifies access again and streams file from B2 with Range support
6. Video/audio player can seek, pause, resume efficiently

### Streaming Flow (Public Content - Previews)

1. Client requests: `GET /api/media/song/:id/preview` (no auth required)
2. Backend returns streaming URL for preview
3. Client streams directly (no auth needed for previews)

## Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │ 1. POST /api/uploads/songs
         │    (with auth token)
         ▼
┌─────────────────┐
│   Backend       │
│   (Express)     │
├─────────────────┤
│ uploads.js      │──── 2. Upload to B2
│                 │      (multipart if large)
└────────┬────────┘
         │ 3. Store public URL
         ▼
┌─────────────────┐
│   Database      │
│   (Postgres)    │
└─────────────────┘

Later, for playback:

┌─────────────────┐
│   Frontend      │
└────────┬────────┘
         │ 1. GET /api/media/song/:id
         │    (with auth token)
         ▼
┌─────────────────┐
│   Backend       │
├─────────────────┤
│ media.js        │──── 2. Verify ownership/purchase
│                 │──── 3. Return stream URL
└────────┬────────┘
         │ 4. GET /api/media/stream/:bucket/:path
         │    (with auth token)
         ▼
┌─────────────────┐
│   Backend       │
├─────────────────┤
│ media.js        │──── 5. Verify access again
│ (stream route)  │──── 6. Stream from B2 (with Range)
└────────┬────────┘
         │ 7. Pipe response to client
         ▼
┌─────────────────┐
│  Backblaze B2   │
└─────────────────┘
```

## Key Features

### 1. Large File Uploads

Automatically uses B2 multipart upload API for files exceeding threshold:

```javascript
// In backend/src/lib/backblaze.js
const LARGE_UPLOAD_THRESHOLD = process.env.BACKBLAZE_LARGE_UPLOAD_THRESHOLD_BYTES || 50MB;

if (fileSize > LARGE_UPLOAD_THRESHOLD) {
  // Use startLargeFile → uploadPart (chunked) → finishLargeFile
} else {
  // Use simple uploadFile
}
```

### 2. Streaming with Range Support

The `/api/media/stream/:bucket/:encodedPath` endpoint:
- Accepts HTTP `Range` header for partial content requests
- Returns `206 Partial Content` with `Content-Range` header
- Enables efficient seeking in video/audio players

### 3. Authentication & Authorization

Every stream request (except previews) requires:
1. Valid JWT token in `Authorization: Bearer <token>` header
2. User must either:
   - Own the content (creator), OR
   - Have purchased the content (via `purchases` table)

### 4. Retry & Error Handling

Upload function includes:
- Exponential backoff on transient errors
- Configurable retry attempts
- Detailed error logging

## Migration from Supabase

See **[MIGRATION.md](./MIGRATION.md)** for a script to copy existing files from Supabase Storage to Backblaze B2.

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKBLAZE_ACCOUNT_ID` | Yes | - | Your B2 application key ID |
| `BACKBLAZE_APPLICATION_KEY` | Yes | - | Your B2 application key secret |
| `BACKBLAZE_BUCKET_NAME` | Yes | - | Primary bucket name |
| `BACKBLAZE_PUBLIC_BASE` | No | `https://f001.backblazeb2.com/file/<bucket>` | Public URL base |
| `BACKBLAZE_LARGE_UPLOAD_THRESHOLD_BYTES` | No | 52428800 (50MB) | Size threshold for multipart uploads |
| `BACKBLAZE_PART_SIZE` | No | 10485760 (10MB) | Part size for multipart uploads |

## Troubleshooting

### Upload fails with "Bucket not found"
- Verify `BACKBLAZE_BUCKET_NAME` matches your B2 bucket exactly
- Check application key has access to the bucket

### Streaming returns 404
- Ensure file path stored in database matches actual path in B2
- Check `BACKBLAZE_PUBLIC_BASE` is correct

### CORS errors in browser
- Add your frontend domain to B2 bucket CORS rules
- Include `localhost` for development

### Large uploads timeout
- Check network stability
- Reduce `BACKBLAZE_PART_SIZE` for slower connections
- Increase timeout in your proxy/load balancer

## Security Best Practices

1. ✅ Never commit `.env` with real credentials
2. ✅ Use environment secrets in production (e.g., Render dashboard)
3. ✅ Set bucket to Public only if streaming directly to browsers
4. ✅ All authenticated content flows through `/api/media/stream` with verification
5. ✅ Rotate application keys every 90 days
6. ✅ Monitor B2 dashboard for unexpected usage patterns
7. ✅ Use separate keys for dev/staging/production

## Cost Comparison

**Supabase Storage**: ~$25-50/month for 100GB + 1TB downloads  
**Backblaze B2**: ~$7.50/month for same usage (70-85% savings)

See [BACKBLAZE_BUCKET_SETUP.md](./BACKBLAZE_BUCKET_SETUP.md) for detailed cost breakdown.

## Support

For issues:
1. Check [B2 Documentation](https://www.backblaze.com/b2/docs/)
2. Review backend logs for error details
3. Test with [B2 CLI](https://www.backblaze.com/b2/docs/quick_command_line.html)
4. Check CORS rules if streaming fails in browser