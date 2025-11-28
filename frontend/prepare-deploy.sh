#!/bin/bash

# Exit on error
set -e

echo "🚀 Preparing Next.js app for cPanel deployment..."

# 1. Check if build exists
if [ ! -d ".next/standalone" ]; then
    echo "❌ Error: Standalone build not found."
    echo "👉 Please run 'npm run build' first."
    exit 1
fi

# 2. Prepare the standalone directory
echo "📦 Copying static assets..."
# Copy public folder
cp -r public .next/standalone/

# Copy static assets
mkdir -p .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/

# 3. Create a custom server.js for cPanel (Passenger) compatibility
# cPanel often sets the PORT env var, but sometimes needs a specific startup file.
# The standalone server.js is usually fine, but let's ensure we have a clean entry point.
# We will use the generated server.js as the entry point.

# 4. Zip the content
echo "zip -r deploy-package.zip .next/standalone/*"
echo "🗜️  Creating deploy-package.zip..."

cd .next/standalone
# Zip everything in the standalone folder
# We use 'zip' command. If not available, user might need to install it or zip manually.
if command -v zip >/dev/null 2>&1; then
    zip -r ../../deploy-package.zip . .[^.]*
    echo "✅ deploy-package.zip created in frontend directory!"
else
    echo "⚠️  'zip' command not found. Please manually zip the contents of '.next/standalone'"
fi

echo ""
echo "📋 Deployment Instructions:"
echo "1. Go to cPanel > Setup Node.js App"
echo "2. Create a new app."
echo "3. Upload 'deploy-package.zip' to the app root and extract it."
echo "4. Set 'Application Startup File' to 'server.js'."
echo "5. Run 'npm install' (optional, as standalone includes dependencies, but good for safety)."
echo "6. Start the app."
