#!/bin/bash

set -e

echo "🚀 NóminaSmart - Quick Start Setup"
echo "=================================="
echo ""

# Check Node version
NODE_VERSION=$(node -v | grep -oE '[0-9]+' | head -1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js v20+ required. You have v$(node -v)"
    exit 1
fi
echo "✅ Node.js v$(node -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"

# Check for .env.local
echo ""
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found"
    echo "   Creating from template..."
    cp .env.local.example .env.local
    echo "⚠️  Edit .env.local with your Supabase credentials before running!"
    echo ""
    cat .env.local
    echo ""
    echo "📝 Instructions:"
    echo "   1. Go to https://supabase.com"
    echo "   2. Create a project"
    echo "   3. Copy Project URL to NEXT_PUBLIC_SUPABASE_URL"
    echo "   4. Copy Anon Key to NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   5. Copy Service Role Key to SUPABASE_SERVICE_ROLE_KEY"
    echo "   6. Save and run: npm run dev"
    exit 1
else
    echo "✅ .env.local found"
fi

# Build TypeScript
echo ""
echo "🔨 Building project..."
npm run build
echo "✅ Build successful"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. npm run dev          # Start development server"
echo "  2. http://localhost:3000/es  # Visit the app (Spanish)"
echo ""
