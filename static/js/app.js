class YouTubeDownloader {
    constructor() {
        this.currentVideo = null;
        this.selectedFormat = null;
        this.downloads = JSON.parse(localStorage.getItem('yt_downloads') || '[]');
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.renderHistory();
    }

    bindElements() {
        this.urlInput = document.getElementById('urlInput');
        this.fetchBtn = document.getElementById('fetchBtn');
        this.loadingSection = document.getElementById('loadingSection');
        this.videoSection = document.getElementById('videoSection');
        this.videoThumbnail = document.getElementById('videoThumbnail');
        this.videoDuration = document.getElementById('videoDuration');
        this.videoTitle = document.getElementById('videoTitle');
        this.videoUploader = document.getElementById('videoUploader');
        this.videoViews = document.getElementById('videoViews');
        this.formatsList = document.getElementById('formatsList');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.newVideoBtn = document.getElementById('newVideoBtn');
        this.downloadProgress = document.getElementById('downloadProgress');
        this.downloadComplete = document.getElementById('downloadComplete');
        this.downloadedTitle = document.getElementById('downloadedTitle');
        this.downloadLink = document.getElementById('downloadLink');
        this.anotherBtn = document.getElementById('anotherBtn');
        this.historyList = document.getElementById('historyList');
        this.emptyHistory = document.getElementById('emptyHistory');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toastMessage');
    }

    bindEvents() {
        this.fetchBtn.addEventListener('click', () => this.fetchVideoInfo());
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchVideoInfo();
        });
        this.downloadBtn.addEventListener('click', () => this.startDownload());
        this.newVideoBtn.addEventListener('click', () => this.reset());
        this.anotherBtn.addEventListener('click', () => this.reset());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    }

    showToast(message, isError = true) {
        this.toastMessage.textContent = message;
        this.toast.querySelector('i').className = isError 
            ? 'fa-solid fa-circle-exclamation' 
            : 'fa-solid fa-circle-check';
        this.toast.style.background = isError ? 'var(--error)' : 'var(--success)';
        this.toast.classList.remove('hidden');
        
        setTimeout(() => {
            this.toast.classList.add('hidden');
        }, 4000);
    }

    async fetchVideoInfo() {
        const url = this.urlInput.value.trim();
        
        if (!url) {
            this.showToast('Please enter a YouTube URL');
            return;
        }

        this.loadingSection.classList.remove('hidden');
        this.videoSection.classList.add('hidden');
        this.downloadProgress.classList.add('hidden');
        this.downloadComplete.classList.add('hidden');

        try {
            const response = await fetch('/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch video info');
            }

            this.currentVideo = { ...data, url };
            this.displayVideoInfo(data);
            
        } catch (error) {
            this.showToast(error.message);
            this.loadingSection.classList.add('hidden');
        }
    }

    displayVideoInfo(data) {
        this.loadingSection.classList.add('hidden');
        this.videoSection.classList.remove('hidden');

        this.videoThumbnail.src = data.thumbnail || '';
        this.videoTitle.textContent = data.title || 'Unknown Title';
        
        this.videoDuration.textContent = this.formatDuration(data.duration);
        this.videoUploader.querySelector('span').textContent = data.uploader || 'Unknown';
        this.videoViews.querySelector('span').textContent = this.formatViews(data.view_count);

        this.renderFormats(data.formats);
        
        // Select first format by default
        if (data.formats && data.formats.length > 0) {
            this.selectFormat(data.formats[0]);
        }
    }

    renderFormats(formats) {
        this.formatsList.innerHTML = formats.map((fmt, index) => `
            <div class="format-item ${index === 0 ? 'selected' : ''}" data-format-id="${fmt.format_id}" data-is-audio="${fmt.type === 'audio'}">
                <div class="format-info">
                    <div class="format-radio"></div>
                    <span class="format-quality">${fmt.quality}</span>
                    <span class="format-type">${fmt.type}</span>
                </div>
                <span class="format-size">${this.formatSize(fmt.size)}</span>
            </div>
        `).join('');

        this.formatsList.querySelectorAll('.format-item').forEach(item => {
            item.addEventListener('click', () => {
                const formatId = item.dataset.formatId;
                const isAudio = item.dataset.isAudio === 'true';
                const format = formats.find(f => f.format_id === formatId);
                if (format) this.selectFormat(format);
            });
        });
    }

    selectFormat(format) {
        this.selectedFormat = format;
        
        this.formatsList.querySelectorAll('.format-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.formatId === format.format_id);
        });
        
        this.downloadBtn.disabled = false;
    }

    async startDownload() {
        if (!this.currentVideo || !this.selectedFormat) return;

        this.videoSection.classList.add('hidden');
        this.downloadProgress.classList.remove('hidden');

        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: this.currentVideo.url,
                    format_id: this.selectedFormat.format_id,
                    is_audio: this.selectedFormat.type === 'audio'
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Download failed');
            }

            this.downloadProgress.classList.add('hidden');
            this.downloadComplete.classList.remove('hidden');
            this.downloadedTitle.textContent = data.title;
            this.downloadLink.href = data.download_url;
            this.downloadLink.download = data.filename;

            // Add to history
            this.addToHistory({
                title: data.title,
                thumbnail: this.currentVideo.thumbnail,
                filename: data.filename,
                download_url: data.download_url,
                date: new Date().toISOString()
            });

            this.showToast('Download complete!', false);
            
        } catch (error) {
            this.showToast(error.message);
            this.downloadProgress.classList.add('hidden');
            this.videoSection.classList.remove('hidden');
        }
    }

    addToHistory(item) {
        this.downloads.unshift(item);
        if (this.downloads.length > 10) {
            this.downloads = this.downloads.slice(0, 10);
        }
        localStorage.setItem('yt_downloads', JSON.stringify(this.downloads));
        this.renderHistory();
    }

    renderHistory() {
        const hasDownloads = this.downloads.length > 0;
        
        this.emptyHistory.classList.toggle('hidden', hasDownloads);
        this.clearHistoryBtn.classList.toggle('hidden', !hasDownloads);

        if (!hasDownloads) {
            this.historyList.innerHTML = '';
            return;
        }

        this.historyList.innerHTML = this.downloads.map(item => `
            <div class="history-item">
                <img src="${item.thumbnail}" alt="" class="history-thumb" onerror="this.style.display='none'">
                <div class="history-details">
                    <div class="history-title">${item.title}</div>
                    <div class="history-meta">${this.timeAgo(item.date)}</div>
                </div>
                <div class="history-actions">
                    <a href="${item.download_url}" download="${item.filename}" title="Download again">
                        <i class="fa-solid fa-download"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }

    clearHistory() {
        this.downloads = [];
        localStorage.removeItem('yt_downloads');
        this.renderHistory();
    }

    reset() {
        this.urlInput.value = '';
        this.currentVideo = null;
        this.selectedFormat = null;
        this.downloadBtn.disabled = true;
        
        this.videoSection.classList.add('hidden');
        this.loadingSection.classList.add('hidden');
        this.downloadProgress.classList.add('hidden');
        this.downloadComplete.classList.add('hidden');
        
        this.urlInput.focus();
    }

    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const hours = Math.floor(mins / 60);
        
        if (hours > 0) {
            return `${hours}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    formatViews(views) {
        if (!views) return '0 views';
        if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
        if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
        return `${views} views`;
    }

    formatSize(bytes) {
        if (!bytes || bytes === 0) return 'Unknown';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }

    timeAgo(dateString) {
        const date = new Date(dateString);
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new YouTubeDownloader();
});
