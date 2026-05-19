#!/bin/bash

echo "=== YouTube Downloader Setup ==="
echo ""

# Check Python version
echo "Checking Python version..."
python3 --version

# Update yt-dlp
echo ""
echo "Updating yt-dlp..."
pip3 install --upgrade yt-dlp

# Install dependencies
echo ""
echo "Installing dependencies..."
pip3 install -r requirements.txt

echo ""
echo "=== Setup Complete ==="
echo "Run: python3 app.py"
