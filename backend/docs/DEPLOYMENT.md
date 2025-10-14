# CediStream Production Deployment Guide

This guide provides step-by-step instructions for deploying CediStream to production using Netlify (frontend) and Render (backend).

## 🏗️ Architecture Overview

- **Frontend**: React SPA hosted on Netlify
- **Backend**: Node.js API hosted on Render
- **Database**: Neon PostgreSQL
- **File Storage**: Supabase
- **Payments**: Paystack
- **Monitoring**: UptimeRobot

## 📋 Prerequisites

1. **Neon PostgreSQL Database**
   - Create account at [neon.tech](https://neon.tech)
   - Create a new project and database
   - Note your connection string

2. **Supabase Storage**
   - Create account at [supabase.com](https://supabase.com)
   - Create a new project
   - Set up storage buckets: `profiles`, `albums`, `media`, `videos`
   - Note your project URL and keys

3. **Paystack Account**
   - Create account at [paystack.com](https://paystack.com)
   - Get your API keys from the dashboard

4. **GitHub Repository**
   - Ensure your code is pushed to GitHub
   - Repository should be public or you need paid Netlify/Render plans

## 🚀 Step 1: Backend Deployment (Render)

### 1.1 Prepare the Backend

1. **Generate a strong JWT secret**:
   ```bash
   # Use this command or any secure random string generator
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Set up your database schema**:
   - Go to your Neon console
   - Run the SQL from `backend/database/schema.sql`
   - Run migrations from `backend/database/` as needed

### 1.2 Deploy to Render

1. **Create Render Account**: Sign up at [render.com](https://render.com)

2. **Create a New Web Service**:
   - Connect your GitHub repository
   - Choose the backend folder as the root directory
   - Or use the `render.yaml` file in the backend folder

3. **Configure Environment Variables** in Render dashboard:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=your-neon-postgres-connection-string
   JWT_SECRET=your-generated-jwt-secret
   FRONTEND_URL=https://cedistream.netlify.app
   SUPABASE_URL=your-supabase-project-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   SUPABASE_BUCKET=profiles
   SUPABASE_BUCKET_ALBUMS=albums
   SUPABASE_BUCKET_MEDIA=media
   SUPABASE_BUCKET_VIDEOS=videos
   SUPABASE_BUCKET_PREVIEWS=media
   PAYSTACK_SECRET_KEY=your-paystack-secret-key
   PAYSTACK_PUBLIC_KEY=your-paystack-public-key
   ```

4. **Deploy Settings**:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`

5. **Deploy and Test**:
   - Click "Deploy"
   - Wait for deployment to complete
   - Test your API at `https://cedistream.onrender.com/api/health`

## 🌐 Step 2: Frontend Deployment (Netlify)

### 2.1 Prepare the Frontend

1. **Update backend URL**: The frontend will automatically use your Render backend URL through environment variables.

### 2.2 Deploy to Netlify

1. **Create Netlify Account**: Sign up at [netlify.com](https://netlify.com)

2. **Create a New Site**:
   - Connect your GitHub repository
   - Choose the frontend folder as the base directory
   - Or use the `netlify.toml` file in the frontend folder

3. **Configure Build Settings**:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

4. **Configure Environment Variables** in Netlify dashboard:
   ```
   VITE_BACKEND_URL=https://cedistream.onrender.com
   ```

5. **Deploy and Test**:
   - Click "Deploy site"
   - Wait for deployment to complete
   - Test your app at `https://cedistream.netlify.app`

## 📊 Step 3: Monitoring Setup (UptimeRobot)

### 3.1 Set Up UptimeRobot

1. **Create Account**: Sign up at [uptimerobot.com](https://uptimerobot.com)

2. **Add Backend Monitor**:
   - Monitor Type: HTTP(s)
   - URL: `https://cedistream.onrender.com/api/health`
   - Monitoring Interval: 5 minutes
   - Alert Contacts: Your email

3. **Add Frontend Monitor**:
   - Monitor Type: HTTP(s)
   - URL: `https://cedistream.netlify.app`
   - Monitoring Interval: 5 minutes
   - Alert Contacts: Your email

### 3.2 Keep Render Service Alive

Render free tier spins down after 15 minutes of inactivity. UptimeRobot will ping your backend every 5 minutes to keep it alive.

## 🔧 Step 4: Production Optimizations

### 4.1 Database Optimizations

1. **Add Indexes** (run in Neon console):
   ```sql
   -- Run the contents of backend/database/idx_purchases_for_analytics.sql
   -- This adds performance indexes for analytics queries
   ```

2. **Connection Pooling**: Already configured in the app (max 10 connections)

### 4.2 Security Checklist

- ✅ JWT secrets are strong and secure
- ✅ Database connection uses SSL
- ✅ CORS is configured for your domain only
- ✅ Rate limiting is enabled
- ✅ Security headers are set
- ✅ No secrets in frontend code
- ✅ Production error handling (no stack traces leaked)

### 4.3 Performance Checklist

- ✅ Frontend assets are minified and chunked
- ✅ Database queries are optimized with indexes
- ✅ File uploads go directly to Supabase
- ✅ Images are properly sized and compressed
- ✅ API responses are cached where appropriate

## 🔄 Step 5: Development Workflow

### 5.1 Local Development

```bash
# Install dependencies for both frontend and backend
npm install

# Start both frontend and backend in development mode
npm run dev

# Or start individually:
npm run dev:frontend  # Starts on http://localhost:3000
npm run dev:backend   # Starts on http://localhost:5000
```

### 5.2 Environment Setup

1. **Backend**: Copy `backend/.env.example` to `backend/.env` and fill in development values
2. **Frontend**: Copy `frontend/.env.example` to `frontend/.env` (optional for development)

### 5.3 Database Migrations

```bash
cd backend

# Run initial setup
npm run migrate
npm run seed

# Apply specific migrations
npm run migrate-users
npm run migrate-add-username-pin
# ... etc
```

## 🚨 Troubleshooting

### Common Issues

1. **Backend won't start**:
   - Check environment variables are set correctly
   - Verify database connection string
   - Check Render logs for specific errors

2. **Frontend can't connect to backend**:
   - Verify `VITE_BACKEND_URL` is set correctly
   - Check CORS configuration in backend
   - Ensure backend is deployed and responding

3. **File uploads failing**:
   - Check Supabase keys and bucket names
   - Verify bucket policies allow uploads
   - Check file size limits

4. **Payments not working**:
   - Verify Paystack keys (use test keys for testing)
   - Check webhook configuration if using webhooks
   - Ensure HTTPS is working

### Getting Help

- Check application logs in Render dashboard
- Use browser developer tools to debug frontend issues
- Test API endpoints directly using tools like Postman
- Monitor uptime and performance with UptimeRobot

## 🎉 Success!

Your CediStream application should now be running in production with:

- ✅ Scalable backend on Render
- ✅ Fast frontend on Netlify CDN
- ✅ Reliable database with Neon
- ✅ File storage with Supabase
- ✅ Payment processing with Paystack
- ✅ 24/7 monitoring with UptimeRobot

---

**Need help?** Check the logs in your Render and Netlify dashboards, and ensure all environment variables are set correctly.