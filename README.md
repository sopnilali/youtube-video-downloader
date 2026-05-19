# YouTube Video Downloader Web App

A modern web application for downloading YouTube videos and audio in various formats and qualities.

## Features

- Download YouTube videos in multiple qualities (360p, 720p, 1080p)
- Extract audio as MP3
- Live preview with video thumbnails
- Clean, responsive UI
- Download history management

## Requirements

- Python 3.9+
- Flask
- yt-dlp
- FFmpeg (for audio extraction)

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Install FFmpeg (macOS)
brew install ffmpeg

# Run the app
python3 app.py
```

## Usage

1. Open `http://localhost:5000` in your browser
2. Paste a YouTube URL
3. Select your preferred format
4. Click Download

## Tech Stack

- **Backend:** Flask (Python)
- **Frontend:** HTML, CSS, Bootstrap 5, JavaScript
- **Engine:** yt-dlp
