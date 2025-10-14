#!/bin/bash
# Development setup script for CediStream

echo "🚀 Setting up CediStream development environment..."

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd "$(dirname "$0")"
npm install

# Install frontend dependencies  
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

# Go back to backend
cd ../backend

echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  Backend:  cd backend && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Or run both with: npm run dev (from backend folder)"