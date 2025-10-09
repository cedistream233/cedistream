# CediStream Setup Guide

## Database & Storage Setup

Your app now uses a **hybrid approach**:
- **Neon PostgreSQL** for data storage (albums, videos, purchases)
- **Supabase** for file storage only (images, audio files, video files)

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
   - Copy and paste the contents of `database/seed.sql`
   - Execute the script

## Step 2: Supabase Storage Setup (Optional)

If you want to enable file uploads for album covers, audio files, and videos:

1. **Get your Supabase project credentials**:
   - Project URL: `https://your-project-ref.supabase.co`
   - Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Service role key (for admin operations)

2. **Add to your `.env` file**:
   ```
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Create storage buckets** in Supabase:
   - Go to Storage in your Supabase dashboard
   - Create buckets: `album-covers`, `audio-files`, `video-files`
   - Set appropriate policies for public read access

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
2. **Set up file upload flows** to Supabase storage
3. **Configure authentication** (Neon Auth or custom JWT)
4. **Add Paystack payment processing**
5. **Deploy to production** (Vercel + Neon + Supabase)