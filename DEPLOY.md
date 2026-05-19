# Deploy to PythonAnywhere

## Step 1: Create Account
1. Go to https://www.pythonanywhere.com/
2. Sign up for a free account

## Step 2: Upload Code
1. Open the **Consoles** tab → Start a **Bash** console
2. Clone your repo or upload files:
   ```bash
   git clone https://github.com/YOUR_USERNAME/youtube-video-downloader-web-app.git
   cd youtube-video-downloader-web-app
   ```

## Step 3: Create Virtual Environment
```bash
mkvirtualenv --python=/usr/bin/python3.10 ytdownloader
pip install -r requirements.txt
```

## Step 4: Configure Web App
1. Go to **Web** tab → **Add a new web app**
2. Choose **Manual configuration** → Python 3.10
3. Set **Source code** directory: `/home/YOUR_USERNAME/youtube-downloader`
4. Set **Working directory**: `/home/YOUR_USERNAME/youtube-downloader`
5. Set **WSGI configuration file**: Edit it to contain:
   ```python
   import sys
   project_home = '/home/YOUR_USERNAME/youtube-downloader'
   if project_home not in sys.path:
       sys.path.insert(0, project_home)
   
   from app import app as application
   ```

## Step 5: Create Downloads Directory
```bash
mkdir -p /home/YOUR_USERNAME/youtube-downloader/downloads
```

## Step 6: Reload Web App
Click the green **Reload** button in the Web tab.

## Step 7: Update yt-dlp (Important)
In a Bash console:
```bash
workon ytdownloader
pip install --upgrade yt-dlp
```

## ⚠️ Important Notes

- **Free tier limitation**: PythonAnywhere free accounts cannot access YouTube directly (YouTube blocks datacenter IPs). You may need a **paid account** ($5/mo) for unrestricted internet access.
- **FFmpeg**: Pre-installed on PythonAnywhere.
- **Storage**: Free tier has 512MB storage limit.
- **CPU**: Free tier has limited daily CPU time.

## Alternative: Use Railway or Render
If PythonAnywhere free tier doesn't work due to YouTube IP blocks, try:
- **Railway.app** - $5 free credit
- **Render.com** - Free tier with 750 hours
