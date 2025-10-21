# Video streaming performance notes

This service streams videos from Backblaze B2 with proper HTTP Range support and low-latency headers. For best results in production:

- Use signed, direct B2 URLs for private content (preferred). The backend will try to generate a short-lived signed URL via B2 download authorization. The browser then streams directly from B2/CDN.
- If signing fails, the server falls back to a streaming proxy (`/api/media/stream/:bucket/:path`) that supports Range requests and CORS.
- Previews are public-cacheable for 24h by default; paid media responses are non-cacheable by shared caches.

## CORS for Backblaze B2 bucket

If you use Backblaze B2 directly (or via a CDN), configure CORS on the bucket to allow video range requests from your frontend origins. Example policy:

[
  {
    "corsRuleName": "video-range",
    "allowedOrigins": [
      "https://your-frontend-domain",
      "http://localhost:3000"
    ],
    "allowedHeaders": ["*"],
    "allowedOperations": ["b2_download_file_by_name", "b2_download_file_by_id"],
    "exposeHeaders": [
      "Accept-Ranges",
      "Content-Length",
      "Content-Range",
      "Content-Type",
      "X-Content-Duration"
    ],
    "maxAgeSeconds": 3600
  }
]

Backblaze docs: https://www.backblaze.com/b2/docs/cors_rules.html

### Quick setup checklist (minimal, actionable)

- Ensure your Backblaze bucket has a CORS rule that allows your frontend origin(s) (example above).
- If you have a custom download domain (recommended), set `BACKBLAZE_PUBLIC_BASE` to that URL (no trailing slash). This lets the server return direct signed URLs that are CORS-friendly.
- If you can't set CORS on Backblaze (or prefer immediate safety), let the app proxy streams via `/api/media/stream/...` (this is currently the default fallback).
- Monitor `f003.backblazeb2.com` usage: if you see requests to that host from browsers and CORS errors, configure the bucket CORS or switch to proxying.

### Temporary forced-proxy option

We added a short-term safety toggle: `BACKBLAZE_ALWAYS_PROXY`.
- Default in this branch: `BACKBLAZE_ALWAYS_PROXY=true` (server will return proxied `/api/media/stream/...` URLs by default to avoid CORS).
- You can set `BACKBLAZE_ALWAYS_PROXY=false` in production after configuring Backblaze CORS and/or `BACKBLAZE_PUBLIC_BASE` to a CORS-friendly download domain.


## Recommended environment

- BACKBLAZE_ACCOUNT_ID and BACKBLAZE_APPLICATION_KEY are required in production.
- Optionally set BACKBLAZE_PUBLIC_BASE to a custom download domain (e.g., a Cloudflare CDN worker/cname to your B2 download endpoint). This improves latency and TLS reuse.
- If using a single physical bucket for all features: BACKBLAZE_BUCKET_NAME=<your-bucket>. You can also use per-feature buckets via BACKBLAZE_BUCKET_VIDEOS, etc.

## Operational notes

- The streaming route caches access checks per user+object for 5 minutes to avoid DB queries on every Range request.
- The proxy returns 206 Partial Content for ranged requests and exposes Accept-Ranges and Content-Range headers so the browser can seek smoothly.
- For previews, responses are cacheable (24h) to reduce origin load.

## Scaling suggestions

- Put a CDN in front of Backblaze download URLs for private content. The backend already returns signed URLs when possible; the CDN will cache based on the canonical B2 URL + Authorization token.
- Consider transcoding to HLS with multiple bitrates (e.g., via FFmpeg + B2) for challenging networks. The current player uses progressive MP4 streaming.
- Monitor 5xx rates and B2 transaction counts; switch the proxy to by-name fetch (already implemented) to minimize B2 list calls.
