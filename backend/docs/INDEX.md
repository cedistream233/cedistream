# Documentation Index

Complete documentation for CediStream backend.

## Quick Links

### Getting Started
- **[README.md](./README.md)** - Project overview, quick start, and setup instructions

### Storage Setup
- **[BACKBLAZE_BUCKET_SETUP.md](./BACKBLAZE_BUCKET_SETUP.md)** ⭐ **Start Here** - Complete guide to setting up Backblaze B2 buckets
- **[BACKBLAZE.md](./BACKBLAZE.md)** - Technical overview of Backblaze integration and architecture

### Deployment
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide for Render and other platforms
- **[PRODUCTION.md](./PRODUCTION.md)** - Production configuration and best practices
- **[SETUP.md](./SETUP.md)** - Detailed setup instructions

### Security
- **[SECURITY.md](./SECURITY.md)** - Security best practices and guidelines

## Documentation by Topic

### 🗄️ Storage

#### Backblaze B2
1. Read [BACKBLAZE_BUCKET_SETUP.md](./BACKBLAZE_BUCKET_SETUP.md) first
2. Set up buckets and environment variables
3. Test uploads and streaming

**Why Backblaze?**
- 70-85% cost savings vs alternatives
- Production-ready with multipart uploads
- Built-in streaming with Range support
- Simple pricing: $0.005/GB storage, first 3x downloads free

### 🚀 Deployment

1. Read [SETUP.md](./SETUP.md) for initial setup
2. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for platform-specific instructions
3. Review [PRODUCTION.md](./PRODUCTION.md) for production config
4. Check [SECURITY.md](./SECURITY.md) for security hardening

### 🔧 Development

#### Environment Setup
```bash
# 1. Install dependencies
npm install

# 2. Copy and configure .env
cp .env.example .env
# Edit .env with your values

# 3. Run migrations
npm run migrate

# 4. Start development server
npm run dev
```

#### Key Scripts
```bash
npm run dev              # Start development server
npm run migrate          # Run database migrations
npm run seed             # Seed sample data
npm run test             # Run tests (when available)
```

### 📊 Database

#### Migrations
Located in `backend/database/` folder:
- `schema.sql` - Initial schema
- `add_*.sql` - Feature migrations
- Run with: `npm run migrate` or `node scripts/migrate.js`

#### Seeding
- `seed.sql` - Basic seed data
- `users_seed.sql` - Test users
- Run with: `npm run seed`

### 🔐 Authentication

JWT-based authentication with:
- Token-based auth
- PIN-based password reset
- Role-based access control (creator, supporter, admin)
- Rate limiting on auth endpoints

See [SECURITY.md](./SECURITY.md) for details.

### 💰 Payments

Paystack integration with:
- Subscription support
- One-time purchases
- Webhook handling
- Fee splitting (platform + creator)

### 🎵 Media Handling

#### Upload Flow
1. Client uploads via `/api/uploads/songs`, `/api/uploads/videos`, etc.
2. Backend detects file size:
   - **Small files** (< 50MB): Direct upload
   - **Large files** (≥ 50MB): Multipart upload
3. Public URL stored in database
4. File available for streaming

#### Streaming Flow
1. Client requests media URL with auth token
2. Backend verifies ownership or purchase
3. Returns streaming URL: `/api/media/stream/:bucket/:path`
4. Client streams with Range support for seeking

See [BACKBLAZE.md](./BACKBLAZE.md) for architecture details.

## Common Tasks

### Setting Up Backblaze B2
```bash
# 1. Follow BACKBLAZE_BUCKET_SETUP.md to create buckets
# 2. Add to .env:
BACKBLAZE_ACCOUNT_ID=...
BACKBLAZE_APPLICATION_KEY=...
BACKBLAZE_BUCKET_NAME=cedistream-media
BACKBLAZE_PUBLIC_BASE=https://f001.backblazeb2.com/file/cedistream-media

# 3. Test upload
npm run dev
# Upload a file via frontend or Postman
```

### Deploying to Production
```bash
# 1. Set environment variables in hosting platform (Render)
# 2. Push code to git
# 3. Platform auto-deploys
# 4. Run migrations via SSH or platform console
# 5. Verify health endpoint: /health
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for platform-specific instructions.

### Running Database Migrations
```bash
# Run all pending migrations
npm run migrate

# Run specific migration
node scripts/migrate-add-songs.js
```

### Troubleshooting

#### Uploads fail
- Check storage env vars are set correctly
- Verify bucket exists and is accessible
- Check file size limits
- Review backend logs

#### Streaming not working
- Verify authentication token is valid
- Check CORS rules in Backblaze bucket
- Ensure bucket is public (or use streaming endpoint)
- Test Range header support

#### Database connection fails
- Check `DATABASE_URL` is correct
- Verify database is running
- Check SSL mode (usually `?sslmode=require`)
- Review firewall rules

## Support

For issues:
1. Check relevant documentation above
2. Review backend logs: `npm run dev` (watch console)
3. Check [SECURITY.md](./SECURITY.md) for security-related issues
4. Refer to external docs:
   - [Backblaze B2 Docs](https://www.backblaze.com/b2/docs/)
   - [Paystack API Docs](https://paystack.com/docs/api/)
   - [PostgreSQL Docs](https://www.postgresql.org/docs/)

## Contributing

See [README.md](./README.md) for contribution guidelines.
