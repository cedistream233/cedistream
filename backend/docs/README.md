# 🎵 CediStream

A modern music streaming and monetization platform built with React and Node.js.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- PostgreSQL database (Neon recommended)
- Supabase account for file storage
- Paystack account for payments

### Development Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <your-repo-url>
   cd cedistream
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   # Backend environment
   cp backend/.env.example backend/.env
   # Edit backend/.env with your database and API keys
   
   # Frontend environment (optional for development)
   cp frontend/.env.example frontend/.env
   ```

3. **Set up database**:
   ```bash
   cd backend
   npm run migrate
   npm run seed
   ```

4. **Start development servers**:
   ```bash
   # From root directory - starts both frontend and backend
   npm run dev
   
   # Or individually:
   npm run dev:frontend  # http://localhost:3000
   npm run dev:backend   # http://localhost:5000
   ```

## 🏗️ Project Structure

```
cedistream/
├── frontend/          # React frontend (Vite)
│   ├── src/
│   ├── public/
│   └── netlify.toml   # Netlify deployment config
├── backend/           # Node.js API server
│   ├── src/
│   ├── database/      # SQL migrations and schemas
│   ├── scripts/       # Database utilities
│   ├── docs/          # All project documentation
│   ├── render.yaml    # Render deployment config
│   └── workspace.json # Development workspace config
└── README.md          # Quick start guide
```

## 🌟 Features

- **Music Streaming**: Upload and stream songs, albums, and videos
- **Creator Monetization**: Pay-what-you-want pricing model
- **User Authentication**: Secure login with JWT and PIN recovery
- **File Storage**: Supabase integration for media files
- **Payment Processing**: Paystack integration for transactions
- **Admin Dashboard**: Content management and analytics
- **Responsive Design**: Works on all devices

## 🚀 Production Deployment

For detailed production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

**Quick deployment overview**:
- Frontend: Deploy to Netlify
- Backend: Deploy to Render
- Database: Neon PostgreSQL
- Storage: Supabase
- Monitoring: UptimeRobot

## 🛠️ Tech Stack

### Frontend
- React 18 with React Router
- Vite for build tooling
- TailwindCSS for styling
- Framer Motion for animations
- Recharts for analytics

### Backend
- Node.js with Express
- PostgreSQL with native pg driver
- JWT authentication
- Supabase for file storage
- Paystack for payments
- Helmet & rate limiting for security

## 📝 Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only

# Production
npm run build           # Build frontend for production
npm run start:backend   # Start backend in production mode
npm run preview         # Preview production build locally

# Database
cd backend
npm run migrate         # Run database migrations
npm run seed           # Seed database with sample data
```

## 🔧 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secure-secret
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
PAYSTACK_SECRET_KEY=...
# See backend/.env.example for complete list
```

### Frontend (.env)
```env
VITE_BACKEND_URL=http://localhost:5000  # Development
# VITE_BACKEND_URL=https://your-api.onrender.com  # Production
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is private and proprietary.

---

**Need help?** Check out [SETUP.md](./SETUP.md) for detailed setup instructions or [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment.