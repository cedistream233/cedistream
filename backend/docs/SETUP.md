# CediStream Setup Guide

## Database & Storage Setup

Your app now uses a **hybrid approach**:
- **Neon PostgreSQL** for data storage (albums, videos, purchases)
- **Backblaze B2** for file storage only (images, audio files, video files)

## Step 1: Neon Database Setup

1. **Copy your Neon connection string** from your Neon console
2. **Create a `.env` file** in the `backend` folder:
   ```bash
   cp .env.example .env
   ```
3. **Edit `.env`** and add your Neon database URL:
   ```
   DATABASE_URL=postgresql://username:password@ep-example-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. **Run the schema SQL** in your Neon console:
   - Go to your Neon project dashboard
   - Open the SQL Editor
   - Copy and paste the contents of `database/schema.sql`
   - Execute the script

5. **Add sample data** (optional):
6. **Add Users + Username/PIN migrations** (required for auth):
    You can apply from your local terminal or paste into Neon SQL editor.

    Local (Windows cmd):

    - Set up env: ensure `backend/.env` has `DATABASE_URL=...`
    - Apply base users migration (creates `users` and `creator_profiles` tables):
       ```cmd
       cd /d backend
       npm run migrate-users
       ```
    - Add username + PIN columns:
       ```cmd
       npm run migrate-add-username-pin
       ```
    - Add PIN rate limiting fields:
       ```cmd
       npm run migrate-add-pin-rate-limit
       ```

    Or paste these SQL files into Neon SQL editor in order:
    - `database/users_migration.sql`
    - `database/add_username_pin.sql`
    - `database/add_pin_rate_limit.sql`

    Verify columns exist:
    ```sql
    -- Should return columns including username, pin_hash, pin_attempts, pin_lock_until
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN ('username', 'pin_hash', 'pin_attempts', 'pin_lock_until');
    ```

    Quick fallback (only if needed) to manually add username column:
    ```sql
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
    DO $$
    BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
          ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
       END IF;
    END $$;
    ```

   - Copy and paste the contents of `database/seed.sql`
   - Execute the script

## Step 2: Backblaze B2 Storage Setup

For file uploads (album covers, audio files, and videos):

1. **Get your Backblaze B2 credentials**:
   - Account ID and Application Key from https://secure.backblaze.com/b2_buckets.htm
   - Create an Application Key with read/write permissions

2. **Add to your `.env` file**:
   ```
   BACKBLAZE_ACCOUNT_ID=your-account-id
   BACKBLAZE_APPLICATION_KEY=your-application-key
   BACKBLAZE_BUCKET_NAME=cedistream-media
   BACKBLAZE_PUBLIC_BASE=https://s3.eu-central-003.backblazeb2.com
   BACKBLAZE_BUCKET_MEDIA=cedistream-audio-files
   BACKBLAZE_BUCKET_VIDEOS=cedistream-video-files
   BACKBLAZE_BUCKET_PREVIEWS=cedistream-previews
   BACKBLAZE_BUCKET_THUMBNAILS=cedistream-video-thumbnails
   BACKBLAZE_BUCKET_PROFILES=cedistream-profiles
   BACKBLAZE_BUCKET_ALBUMS=cedistream-album-covers
   BACKBLAZE_BUCKET_PROMOTIONS=cedistream-promotions
   ```

3. **Create storage buckets** in Backblaze:
   - Go to Buckets in your Backblaze B2 dashboard
   - Create the buckets listed above
   - Set public or private access as needed
   - Apply CORS rules for streaming (see `backend/cors-rules.json`)

## Step 3: Paystack Integration (Optional)

For payment processing:

1. **Get your Paystack keys** from https://dashboard.paystack.com/#/settings/developer
2. **Add to `.env`**:
   ```
   PAYSTACK_SECRET_KEY=sk_test_your-secret-key
   PAYSTACK_PUBLIC_KEY=pk_test_your-public-key
   ```

## Step 4: Start the Application

1. **Start the backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend** (in a new terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. **Visit**: http://localhost:3000

## What You Should See

- ✅ Albums and videos load from your Neon database
- ✅ No more "empty array" responses
- ✅ Sample Base44 content displays with the Unsplash images
- ✅ Purchase tracking works

## Troubleshooting

**Database connection issues?**
- Check your `DATABASE_URL` is correct
- Ensure your Neon database is not sleeping (free tier)
- Check the Neon console for connection logs

**Still seeing empty data?**
- Verify you ran both `schema.sql` and `seed.sql`
- Check the backend console for database connection logs
- Test the API directly: `curl http://localhost:5000/api/albums`

**Frontend not updating?**
- Hard refresh the browser (Ctrl+F5)
- Check browser developer tools for network errors

## Next Steps

1. **Customize the sample data** in `database/seed.sql` with your own content
2. **Test file upload flows** to Backblaze B2 storage
3. **Configure authentication** (custom JWT-based auth)
4. **Add Paystack payment processing**
5. **Deploy to production** (Render.com + Neon + Backblaze B2)