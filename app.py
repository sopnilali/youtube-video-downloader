import os
import sys
import re
import json
import subprocess
import shutil
import uuid
import threading
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from flask import Flask, render_template, request, jsonify, send_file, Response

app = Flask(__name__)

# Downloads directory
DOWNLOAD_DIR = Path(os.environ.get('DOWNLOAD_DIR', str(Path(__file__).parent / "downloads")))
DOWNLOAD_DIR.mkdir(exist_ok=True)

# Find yt-dlp executable
YT_DLP_CMD = shutil.which('yt-dlp') or shutil.which('yt-dlp.exe')
if not YT_DLP_CMD:
    # Fallback to module execution
    YT_DLP_CMD = sys.executable
    YT_DLP_ARGS = ['-m', 'yt_dlp']
else:
    YT_DLP_ARGS = []

# Progress tracking
download_tasks = {}

def cleanup_old_files():
    """Remove temp files older than 10 minutes."""
    import time
    now = time.time()
    for f in Path('/tmp').glob('*.mp4'):
        if now - f.stat().st_mtime > 600:
            try:
                f.unlink()
            except:
                pass
    for f in Path('/tmp').glob('*.mp3'):
        if now - f.stat().st_mtime > 600:
            try:
                f.unlink()
            except:
                pass

def clean_filename(title):
    """Clean filename for saving."""
    return re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_')

def is_valid_youtube_url(url):
    """Check if URL is a valid YouTube video URL."""
    patterns = [
        r'^https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+',
        r'^https?://(?:www\.)?youtube\.com/shorts/[\w-]+',
        r'^https?://youtu\.be/[\w-]+',
        r'^https?://(?:www\.)?youtube\.com/embed/[\w-]+'
    ]
    return any(re.match(pattern, url) for pattern in patterns)

def extract_video_id(url):
    """Extract YouTube video ID from URL."""
    parsed = urlparse(url)
    if parsed.hostname in ('youtu.be', 'www.youtu.be'):
        return parsed.path[1:]
    if parsed.hostname in ('youtube.com', 'www.youtube.com'):
        if parsed.path.startswith('/shorts/'):
            return parsed.path.split('/')[2]
        if parsed.path.startswith('/embed/'):
            return parsed.path.split('/')[2]
        query = parse_qs(parsed.query)
        return query.get('v', [None])[0]
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/info', methods=['POST'])
def get_info():
    """Get video information using yt-dlp."""
    data = request.get_json()
    url = data.get('url', '').strip()
    
    if not url:
        return jsonify({'error': 'Please provide a URL'}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({'error': 'Invalid YouTube URL'}), 400
    
    try:
        # Use web client for info to get more formats
        cmd = [
            YT_DLP_CMD, *YT_DLP_ARGS,
            '--dump-json',
            '--no-download',
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=web',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            stderr = result.stderr.strip()
            # Filter out deprecation warnings
            stderr_lines = [line for line in stderr.split('\n') if 'Deprecated' not in line and 'deprecated' not in line and 'WARNING' not in line]
            clean_error = '\n'.join(stderr_lines)
            
            if '403' in clean_error or 'Forbidden' in clean_error:
                return jsonify({'error': 'Download blocked (403). Try updating yt-dlp: pip install --upgrade yt-dlp'}), 500
            
            return jsonify({'error': f'Failed to fetch video info'}), 500
        
        info = json.loads(result.stdout.strip().split('\n')[0])
        
        # Build video quality options (720p, 1080p)
        video_formats = [
            {'format_id': '720p', 'quality': '720p', 'ext': 'mp4', 'size': 0},
            {'format_id': '1080p', 'quality': '1080p', 'ext': 'mp4', 'size': 0},
        ]
        
        # Build audio quality options (128kbps, 192kbps)
        audio_formats = [
            {'format_id': '128kbps', 'quality': '128kbps', 'ext': 'mp3', 'size': 0},
            {'format_id': '192kbps', 'quality': '192kbps', 'ext': 'mp3', 'size': 0},
        ]

        return jsonify({
            'success': True,
            'id': info.get('id'),
            'title': info.get('title'),
            'thumbnail': info.get('thumbnail'),
            'duration': info.get('duration'),
            'uploader': info.get('uploader'),
            'view_count': info.get('view_count'),
            'video_formats': video_formats,
            'audio_formats': audio_formats
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Request timed out. Try again.'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['POST'])
def download():
    """Start download and return task ID for progress tracking."""
    data = request.get_json()
    url = data.get('url', '').strip()
    quality = data.get('quality', '')
    is_audio = data.get('is_audio', False)
    
    if not url or not quality:
        return jsonify({'error': 'Missing URL or quality'}), 400
    
    # Cleanup old temp files
    cleanup_old_files()
    
    try:
        # Get video info first for filename
        cmd_info = [
            YT_DLP_CMD, *YT_DLP_ARGS,
            '--dump-json',
            '--no-download',
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            url
        ]
        result = subprocess.run(cmd_info, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            stderr = result.stderr.strip()
            stderr_lines = [line for line in stderr.split('\n') if 'Deprecated' not in line and 'deprecated' not in line and 'WARNING' not in line]
            clean_error = '\n'.join(stderr_lines)
            
            if '403' in clean_error or 'Forbidden' in clean_error:
                return jsonify({'error': 'Download blocked (403). Try updating yt-dlp: pip install --upgrade yt-dlp'}), 500
            
            return jsonify({'error': 'Failed to get video info'}), 500
        
        info = json.loads(result.stdout.strip().split('\n')[0])
        title = clean_filename(info.get('title', 'video'))
        video_id = info.get('id', 'unknown')
        
        # Create task
        task_id = str(uuid.uuid4())[:8]
        
        if is_audio:
            filename = f"{title}_{video_id}.mp3"
            format_spec = 'best'
            audio_quality = quality
        else:
            filename = f"{title}_{video_id}.mp4"
            height = quality.replace('p', '')
            format_spec = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]"
            audio_quality = None
        
        output_template = f"/tmp/{task_id}.%(ext)s"
        
        # Build download command
        cmd = [
            YT_DLP_CMD, *YT_DLP_ARGS,
            '-f', format_spec,
            '-o', output_template,
            '--newline',
            '--no-playlist',
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]
        
        if is_audio:
            cmd.extend([
                '--extract-audio',
                '--audio-format', 'mp3',
                '--audio-quality', audio_quality.replace('kbps', 'K'),
            ])
        else:
            cmd.extend([
                '--merge-output-format', 'mp4',
            ])
        
        cmd.append(url)
        
        # Initialize task
        download_tasks[task_id] = {
            'progress': 0,
            'status': 'downloading',
            'filename': filename,
            'title': info.get('title'),
            'is_audio': is_audio,
            'error': None,
            'file_path': None
        }
        
        # Start download in background thread
        def run_download():
            task = download_tasks[task_id]
            try:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True
                )
                
                for line in process.stdout:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Parse progress percentage
                    if '[download]' in line:
                        match = re.search(r'(\d+(?:\.\d+)?)%', line)
                        if match:
                            task['progress'] = float(match.group(1))
                    
                    # Check for errors
                    if 'ERROR' in line:
                        task['status'] = 'error'
                        task['error'] = line
                        break
                
                process.wait()
                
                if task['status'] != 'error':
                    # Find the downloaded file
                    if is_audio:
                        downloaded_file = Path(f"/tmp/{task_id}.mp3")
                        if not downloaded_file.exists():
                            for ext in ['m4a', 'webm', 'opus']:
                                alt = Path(f"/tmp/{task_id}.{ext}")
                                if alt.exists():
                                    downloaded_file = alt
                                    break
                    else:
                        downloaded_file = Path(f"/tmp/{task_id}.mp4")
                        if not downloaded_file.exists():
                            for ext in ['webm', 'mkv']:
                                alt = Path(f"/tmp/{task_id}.{ext}")
                                if alt.exists():
                                    downloaded_file = alt
                                    break
                    
                    if downloaded_file.exists():
                        task['file_path'] = str(downloaded_file)
                        task['progress'] = 100
                        task['status'] = 'complete'
                    else:
                        task['status'] = 'error'
                        task['error'] = 'File not found after download'
                        
            except Exception as e:
                task['status'] = 'error'
                task['error'] = str(e)
        
        thread = threading.Thread(target=run_download)
        thread.start()
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'filename': filename,
            'title': info.get('title')
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Request timed out. Try again.'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/progress/<task_id>')
def progress(task_id):
    """Get download progress as JSON."""
    task = download_tasks.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    return jsonify({
        'progress': task['progress'],
        'status': task['status'],
        'error': task.get('error')
    })

@app.route('/file/<task_id>')
def serve_file(task_id):
    """Serve downloaded file."""
    task = download_tasks.get(task_id)
    if not task or not task.get('file_path'):
        return jsonify({'error': 'File not ready'}), 404
    
    file_path = Path(task['file_path'])
    if not file_path.exists():
        return jsonify({'error': 'File not found'}), 404
    
    filename = task['filename']
    content_type = 'audio/mpeg' if task['is_audio'] else 'video/mp4'
    
    return send_file(file_path, mimetype=content_type, as_attachment=True, download_name=filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
