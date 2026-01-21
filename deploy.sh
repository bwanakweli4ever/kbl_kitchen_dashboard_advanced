#!/bin/bash

# Production Deployment Script for KBL Kitchen Dashboard
# This script should be run on the production server after pulling changes

set -e  # Exit on any error

echo "🚀 Starting production deployment..."

# Navigate to project directory
cd /var/www/kbl_kitchen_dashboard_advanced || exit 1

echo "📦 Cleaning old dependencies and cache..."

# Remove node_modules and lock files
rm -rf node_modules
rm -f package-lock.json
rm -f pnpm-lock.yaml

# Clear Next.js cache
rm -rf .next

# Clear npm cache (optional but recommended)
npm cache clean --force

echo "📥 Installing dependencies..."

# Install dependencies with legacy peer deps (required for React 19 compatibility)
npm install --legacy-peer-deps

echo "🔨 Building Next.js application..."

# Build the application
npm run build

echo "✅ Deployment completed successfully!"
echo ""
echo "To start the application, run:"
echo "  npm start"
echo ""
echo "Or if using PM2:"
echo "  pm2 restart kbl-kitchen-dashboard"
