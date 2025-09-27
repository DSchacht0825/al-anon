# Al-Anon Recovery Companion - Deployment Guide

## Quick Deploy to Railway

### 1. Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub/Google
3. Install Railway CLI: `npm install -g @railway/cli`

### 2. Deploy the App
```bash
# Login to Railway
railway login

# Create new project
railway new

# Add PostgreSQL database
railway add postgresql

# Deploy the app
railway up

# Set environment variables (Railway will do this automatically)
# DATABASE_URL will be set by Railway's PostgreSQL service
# JWT_SECRET will need to be set manually
railway variables set JWT_SECRET=your-super-secret-jwt-key-here
```

### 3. Your app will be live at the URL Railway provides!

## Alternative: Deploy to Render.com

### 1. Push to GitHub
```bash
# Create new repo on GitHub
# Then push this code:
git remote add origin https://github.com/yourusername/al-anon-app.git
git push -u origin main
```

### 2. Deploy on Render
1. Go to [render.com](https://render.com)
2. Connect GitHub
3. Create new "Web Service"
4. Select your repository
5. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Add PostgreSQL database
7. Set environment variables:
   - `DATABASE_URL` (auto-set by Render)
   - `JWT_SECRET=your-secret-key`

## Environment Variables Needed

- `DATABASE_URL` - PostgreSQL connection string (auto-set by hosting provider)
- `JWT_SECRET` - Secret key for JWT tokens (set this manually)
- `NODE_ENV=production` - Enables production mode

## Database Notes

The app automatically:
- Uses PostgreSQL in production (when NODE_ENV=production)
- Uses SQLite locally for development
- Creates all necessary tables on first run

## Local Development

```bash
npm run dev  # Uses SQLite locally
```

## Production Features

- PostgreSQL database for multi-user support
- Persistent data across devices
- Secure authentication with JWT
- Auto-scaling and backup through hosting provider