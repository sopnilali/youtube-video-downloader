import os
import sys
import re
import json
import subprocess
import shutil
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from flask import Flask, render_template, request, jsonify, send_file

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
        # Use yt-dlp to get video info
        cmd = [
            YT_DLP_CMD, *YT_DLP_ARGS,
            '--dump-json',
            '--no-download',
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=android',
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
        
        # Extract formats
        formats = []
        for fmt in info.get('formats', []):
            if fmt.get('vcodec') != 'none' and fmt.get('acodec') != 'none':
                # Combined video+audio
                quality = fmt.get('quality_label', fmt.get('format_note', 'unknown'))
                if fmt.get('height'):
                    quality = f"{fmt['height']}p"
                formats.append({
                    'format_id': fmt['format_id'],
                    'quality': quality,
                    'ext': fmt.get('ext', 'mp4'),
                    'size': fmt.get('filesize_approx') or fmt.get('filesize') or 0,
                    'type': 'video+audio'
                })
        
        # Also add best audio-only options
        audio_formats = []
        for fmt in info.get('formats', []):
            if fmt.get('vcodec') == 'none' and fmt.get('acodec') != 'none':
                abr = fmt.get('abr', 0)
                audio_formats.append({
                    'format_id': fmt['format_id'],
                    'quality': f"{int(abr)}kbps" if abr else 'audio',
                    'ext': fmt.get('ext', 'm4a'),
                    'size': fmt.get('filesize_approx') or fmt.get('filesize') or 0,
                    'type': 'audio'
                })
        
        # Get best audio format
        best_audio = None
        for af in sorted(audio_formats, key=lambda x: x.get('size', 0), reverse=True):
            if af['ext'] in ('m4a', 'mp4'):
                best_audio = af
                break
        if not best_audio and audio_formats:
            best_audio = audio_formats[0]
        
        # Filter video formats to avoid duplicates and get best ones
        seen_qualities = set()
        filtered_formats = []
        for fmt in sorted(formats, key=lambda x: x.get('size', 0), reverse=True):
            if fmt['quality'] not in seen_qualities and fmt['quality'] not in ('unknown', '') and fmt['size'] > 0:
                seen_qualities.add(fmt['quality'])
                filtered_formats.append(fmt)
        
        # Sort by quality (height)
        def quality_sort_key(f):
            q = f['quality']
            if q.endswith('p'):
                try:
                    return int(q[:-1])
                except:
                    return 0
            return 0
        
        filtered_formats.sort(key=quality_sort_key, reverse=True)
        
        # Add audio-only option
        if best_audio:
            filtered_formats.insert(0, {
                'format_id': best_audio['format_id'],
                'quality': 'Audio Only (MP3)',
                'ext': 'mp3',
                'size': best_audio['size'],
                'type': 'audio'
            })
        
        return jsonify({
            'success': True,
            'id': info.get('id'),
            'title': info.get('title'),
            'thumbnail': info.get('thumbnail'),
            'duration': info.get('duration'),
            'uploader': info.get('uploader'),
            'view_count': info.get('view_count'),
            'formats': filtered_formats
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Request timed out. Try again.'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['POST'])
def download():
    """Download video using yt-dlp."""
    data = request.get_json()
    url = data.get('url', '').strip()
    format_id = data.get('format_id', '')
    is_audio = data.get('is_audio', False)
    
    if not url or not format_id:
        return jsonify({'error': 'Missing URL or format'}), 400
    
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
        
        # Determine output file
        if is_audio:
            output_file = DOWNLOAD_DIR / f"{title}_{video_id}.mp3"
            format_spec = '18'
        else:
            output_file = DOWNLOAD_DIR / f"{title}_{video_id}.mp4"
            format_spec = f"{format_id}/best[height<=1080]"
        
        output_template = str(DOWNLOAD_DIR / f"{title}_{video_id}")
        
        # Build download command
        cmd = [
            YT_DLP_CMD, *YT_DLP_ARGS,
            '-f', format_spec,
            '-o', output_template + '.%(ext)s',
            '--no-playlist',
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]
        
        if is_audio:
            cmd.extend([
                '--extract-audio',
                '--audio-format', 'mp3',
                '--audio-quality', '192K',
            ])
        else:
            # For video, prefer mp4
            cmd.extend([
                '--merge-output-format', 'mp4',
            ])
        
        cmd.append(url)
        
        # Execute download
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            stderr = result.stderr.strip()
            # Filter out deprecation warnings
            stderr_lines = [line for line in stderr.split('\n') if 'Deprecated' not in line and 'deprecated' not in line]
            clean_error = '\n'.join(stderr_lines)
            
            if '403' in clean_error or 'Forbidden' in clean_error:
                return jsonify({'error': 'Download blocked (403). Try updating yt-dlp: pip install --upgrade yt-dlp'}), 500
            
            return jsonify({'error': f'Download failed: {clean_error}'}), 500
        
        # Find downloaded file
        if is_audio:
            downloaded_file = DOWNLOAD_DIR / f"{title}_{video_id}.mp3"
            if not downloaded_file.exists():
                # Try other extensions
                for ext in ['m4a', 'webm', 'opus']:
                    alt = DOWNLOAD_DIR / f"{title}_{video_id}.{ext}"
                    if alt.exists():
                        downloaded_file = alt
                        break
        else:
            downloaded_file = DOWNLOAD_DIR / f"{title}_{video_id}.mp4"
            if not downloaded_file.exists():
                for ext in ['webm', 'mkv']:
                    alt = DOWNLOAD_DIR / f"{title}_{video_id}.{ext}"
                    if alt.exists():
                        downloaded_file = alt
                        break
        
        if not downloaded_file.exists():
            # Search for any file matching pattern
            files = list(DOWNLOAD_DIR.glob(f"{title}_{video_id}*"))
            if files:
                downloaded_file = files[0]
            else:
                return jsonify({'error': 'Download completed but file not found'}), 500
        
        return jsonify({
            'success': True,
            'filename': downloaded_file.name,
            'title': info.get('title'),
            'download_url': f'/file/{downloaded_file.name}'
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Download timed out. The video may be too large.'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/file/<filename>')
def serve_file(filename):
    """Serve downloaded file."""
    file_path = DOWNLOAD_DIR / filename
    if not file_path.exists():
        return jsonify({'error': 'File not found'}), 404
    return send_file(file_path, as_attachment=True)

@app.route('/clear', methods=['POST'])
def clear_downloads():
    """Clear all downloaded files."""
    try:
        for f in DOWNLOAD_DIR.glob('*'):
            if f.is_file():
                f.unlink()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
