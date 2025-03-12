#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "🚀 Setting up your development environment..."

# Check if Node.js is installed
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install it from https://nodejs.org/"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f "./backend/.env" ]; then
    echo "🔧 Creating environment file..."
    cp ./backend/.env.example ./backend/.env
    echo "⚠️ Please edit ./backend/.env with your actual API keys and credentials"
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "1. Edit ./backend/.env with your API keys"
echo "2. Run 'npm run dev' to start both frontend and backend"
echo "" 