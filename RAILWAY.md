# Deploy to Railway

## Prerequisites
- GitHub account
- Railway account (free tier available)

## Step 1: Push to GitHub

```bash
cd /Users/sopnil/Documents/testforme/youtube-downloader
git add -A
git commit -m "Prepare for Railway deployment"
git push origin main
```

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app/)
2. Sign in with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your repository

## Step 3: Configure

Railway auto-detects the `Dockerfile` and builds automatically.

### Environment Variables
Click **Variables** tab and add:

| Variable | Value |
|----------|-------|
| `DOWNLOAD_DIR` | `/tmp/downloads` |
| `PORT` | `5000` |

### Add Persistent Volume (Optional)
For better performance, add a volume:

1. Click **Volumes** → **Add Volume**
2. Mount path: `/tmp/downloads`
3. Size: 1GB (free tier limit)

## Step 4: Deploy

Railway builds and deploys automatically. Click **Settings** → **Domains** to get your public URL.

## ⚠️ Important Notes

### YouTube IP Blocking
Railway uses datacenter IPs which YouTube may block. If downloads fail with 403 errors:

1. **Solution**: Use Railway's **Private Networking** with a proxy
2. **Alternative**: Use a paid VPS (DigitalOcean, Linode) with residential IPs

### Free Tier Limits
- 500 hours/month compute
- 1GB storage
- No custom domains on free tier

### Timeout Settings
- Railway default timeout: 300s (5 min)
- Long videos may timeout
- Consider upgrading to paid tier for longer timeouts

## Step 5: Update yt-dlp

Add a deploy script to keep yt-dlp updated:

```bash
# In Railway dashboard, go to Settings → Deploy
# Add build command:
pip install --upgrade yt-dlp
```

Or add to Dockerfile:
```dockerfile
RUN pip install --no-cache-dir --upgrade yt-dlp
```
