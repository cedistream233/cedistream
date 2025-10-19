# Quick Start - Backblaze B2 Setup

## One-Time Setup

### 1. Create Backblaze B2 Bucket
```bash
# Go to https://secure.backblaze.com
# 1. Create bucket: "cedistream-media" (Public)
# 2. Create application key
# 3. Copy keyID and applicationKey
```

### 2. Configure Environment Variables
```bash
# Add to backend/.env:
BACKBLAZE_ACCOUNT_ID=your_key_id_here
BACKBLAZE_APPLICATION_KEY=your_app_key_here
BACKBLAZE_BUCKET_NAME=cedistream-media
BACKBLAZE_PUBLIC_BASE=https://f001.backblazeb2.com/file/cedistream-media
```

### 3. Install Dependencies
```bash
cd backend
npm install
```

### 4. Start Backend
```bash
npm run dev
```

## Testing

### Test Upload (via frontend or Postman)
```bash
# Upload profile image
POST http://localhost:5000/api/auth/profile/image
Headers: Authorization: Bearer YOUR_TOKEN
Body: form-data with "image" file

# Expected response:
{
  "ok": true,
  "user": {
    "profile_image": "https://f001.backblazeb2.com/file/cedistream-media/profiles/..."
  }
}
```

### Test Streaming
```bash
# 1. Get streaming URL
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/media/song/123

# Response:
{
  "url": "http://localhost:5000/api/media/stream/media/songs%2F..."
}

# 2. Stream the content
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Range: bytes=0-" \
     http://localhost:5000/api/media/stream/media/songs%2F...

# Should stream audio with Range support
```

## What's Next?

1. ✅ Set up your Backblaze B2 buckets
2. ✅ Configure environment variables
3. ✅ Test uploads and streaming

### Full Migration
```bash
node scripts/migrate-storage-to-backblaze.js --update-db --skip-existing
```

## Troubleshooting

### Check if Backblaze is being used
```bash
# Start backend and look for:
✅ Using Backblaze B2 for storage
```

### Test bucket access
```bash
# Upload any file and check B2 dashboard
# File should appear in: cedistream-media/profiles/... (or appropriate folder)
```

### View backend logs
```bash
npm run dev
# Watch console for upload/stream logs
```

## Production Deployment (Render)

### 1. Add Environment Secrets in Render Dashboard
```
BACKBLAZE_ACCOUNT_ID = your_key_id
BACKBLAZE_APPLICATION_KEY = your_app_key
BACKBLAZE_BUCKET_NAME = cedistream-media
BACKBLAZE_PUBLIC_BASE = https://f001.backblazeb2.com/file/cedistream-media
```

### 2. Deploy
```bash
git add .
git commit -m "Add Backblaze B2 storage integration"
git push origin main
# Render auto-deploys
```

### 3. Verify
```bash
# Check health endpoint
curl https://your-backend.onrender.com/health

# Should return:
{
  "ok": true,
  "database": "connected"
}
```

## Quick Reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Start dev | `npm run dev` |
| Dry run migration | `node scripts/migrate-storage-to-backblaze.js --dry-run` |
| Full migration | `node scripts/migrate-storage-to-backblaze.js --update-db` |
| Check logs | Watch console during `npm run dev` |
| View docs | See `backend/docs/INDEX.md` |

## Environment Variables Quick Reference

```env
# Required
BACKBLAZE_ACCOUNT_ID=your_key_id
BACKBLAZE_APPLICATION_KEY=your_app_key
BACKBLAZE_BUCKET_NAME=cedistream-media

# Recommended
BACKBLAZE_PUBLIC_BASE=https://f001.backblazeb2.com/file/cedistream-media

# Optional (defaults shown)
BACKBLAZE_LARGE_UPLOAD_THRESHOLD_BYTES=52428800
BACKBLAZE_PART_SIZE=10485760
```

## Next Steps

1. ✅ Complete one-time setup above
2. ✅ Test upload via your app
3. ✅ Test streaming in browser
4. ✅ Deploy to production
5. 📖 Read full docs: `backend/docs/INDEX.md`
