# Production Deployment Guide

## Issue
After pulling changes, you may encounter:
```
ENOENT: no such file or directory, open '/var/www/kbl_kitchen_dashboard_advanced/node_modules/next/dist/lib/framework/boundary-components.js'
```

This happens when `node_modules` is missing or corrupted in production.

## Quick Fix

Run the deployment script on your production server:

```bash
cd /var/www/kbl_kitchen_dashboard_advanced
bash deploy.sh
```

## Manual Steps

If you prefer to run commands manually:

```bash
# 1. Navigate to project directory
cd /var/www/kbl_kitchen_dashboard_advanced

# 2. Remove old dependencies and cache
rm -rf node_modules
rm -f package-lock.json
rm -rf .next

# 3. Clear npm cache (optional but recommended)
npm cache clean --force

# 4. Install dependencies with legacy peer deps
npm install --legacy-peer-deps

# 5. Build the application
npm run build

# 6. Start the application
npm start
# OR if using PM2:
pm2 restart kbl-kitchen-dashboard
```

## Important Notes

1. **`.npmrc` file**: Make sure the `.npmrc` file with `legacy-peer-deps=true` is present in the project root. This is required for React 19 compatibility.

2. **Node.js version**: Ensure you're using Node.js 18.x or 20.x (recommended for Next.js 15).

3. **PM2**: If using PM2, restart the process after deployment:
   ```bash
   pm2 restart kbl-kitchen-dashboard
   # OR
   pm2 reload kbl-kitchen-dashboard
   ```

4. **Environment variables**: Make sure all required environment variables are set in your production environment.

## Troubleshooting

### If build still fails:

1. Check Node.js version:
   ```bash
   node -v
   # Should be 18.x or 20.x
   ```

2. Check npm version:
   ```bash
   npm -v
   # Should be 9.x or 10.x
   ```

3. Verify `.npmrc` exists:
   ```bash
   cat .npmrc
   # Should show: legacy-peer-deps=true
   ```

4. Check disk space:
   ```bash
   df -h
   ```

5. Try with verbose logging:
   ```bash
   npm install --legacy-peer-deps --verbose
   ```
