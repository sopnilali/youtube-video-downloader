class YouTubeDownloader {
    constructor() {
        this.currentVideo = null;
        this.downloadType = 'video';
        this.selectedVideoQuality = null;
        this.selectedAudioQuality = null;
        this.videoFormats = [];
        this.audioFormats = [];
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
        this.typeButtons = document.querySelectorAll('.type-btn');
        this.videoQualityGroup = document.getElementById('videoQualityGroup');
        this.audioQualityGroup = document.getElementById('audioQualityGroup');
        this.videoQualities = document.getElementById('videoQualities');
        this.audioQualities = document.getElementById('audioQualities');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.newVideoBtn = document.getElementById('newVideoBtn');
        this.downloadProgress = document.getElementById('downloadProgress');
        this.progressStatus = document.getElementById('progressStatus');
        this.downloadComplete = document.getElementById('downloadComplete');
        this.downloadedTitle = document.getElementById('downloadedTitle');
        this.downloadFiles = document.getElementById('downloadFiles');
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

        this.typeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.typeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.downloadType = btn.dataset.type;
                this.updateQualityVisibility();
                this.updateDownloadButton();
            });
        });
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

        this.videoFormats = data.video_formats || [];
        this.audioFormats = data.audio_formats || [];

        this.renderQualityChips();
        this.updateQualityVisibility();
        this.updateDownloadButton();
    }

    renderQualityChips() {
        // Video quality chips
        this.videoQualities.innerHTML = this.videoFormats.map((fmt, i) => `
            <button class="quality-chip ${i === 0 ? 'selected' : ''}" 
                    data-group="video" 
                    data-quality="${fmt.quality}">
                ${fmt.quality}
            </button>
        `).join('');

        // Audio quality chips
        this.audioQualities.innerHTML = this.audioFormats.map((fmt, i) => `
            <button class="quality-chip ${i === 0 ? 'selected' : ''}" 
                    data-group="audio" 
                    data-quality="${fmt.quality}">
                ${fmt.quality}
            </button>
        `).join('');

        // Bind video chip clicks
        this.videoQualities.querySelectorAll('.quality-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.videoQualities.querySelectorAll('.quality-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                this.selectedVideoQuality = {
                    quality: chip.dataset.quality
                };
                this.updateDownloadButton();
            });
        });

        // Bind audio chip clicks
        this.audioQualities.querySelectorAll('.quality-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.audioQualities.querySelectorAll('.quality-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                this.selectedAudioQuality = {
                    quality: chip.dataset.quality
                };
                this.updateDownloadButton();
            });
        });

        // Set defaults
        if (this.videoFormats.length > 0) {
            this.selectedVideoQuality = {
                quality: this.videoFormats[0].quality
            };
        }
        if (this.audioFormats.length > 0) {
            this.selectedAudioQuality = {
                quality: this.audioFormats[0].quality
            };
        }
    }

    updateQualityVisibility() {
        if (this.downloadType === 'video') {
            this.videoQualityGroup.classList.remove('hidden');
            this.audioQualityGroup.classList.add('hidden');
        } else if (this.downloadType === 'audio') {
            this.videoQualityGroup.classList.add('hidden');
            this.audioQualityGroup.classList.remove('hidden');
        } else {
            this.videoQualityGroup.classList.remove('hidden');
            this.audioQualityGroup.classList.remove('hidden');
        }
    }

    updateDownloadButton() {
        let canDownload = false;
        
        if (this.downloadType === 'video') {
            canDownload = !!this.selectedVideoQuality;
        } else if (this.downloadType === 'audio') {
            canDownload = !!this.selectedAudioQuality;
        } else {
            canDownload = !!this.selectedVideoQuality && !!this.selectedAudioQuality;
        }
        
        this.downloadBtn.disabled = !canDownload;

        // Update button icon based on type
        const icon = this.downloadBtn.querySelector('i');
        if (this.downloadType === 'both') {
            icon.className = 'fa-solid fa-layer-group';
        } else if (this.downloadType === 'audio') {
            icon.className = 'fa-solid fa-music';
        } else {
            icon.className = 'fa-solid fa-download';
        }
    }

    async startDownload() {
        if (!this.currentVideo) return;

        this.videoSection.classList.add('hidden');
        this.downloadProgress.classList.remove('hidden');
        this.downloadFiles.innerHTML = '';

        const downloads = [];

        try {
            // Download video if needed
            if (this.downloadType === 'video' || this.downloadType === 'both') {
                if (!this.selectedVideoQuality) throw new Error('No video quality selected');
                
                this.progressStatus.textContent = 'Downloading video...';
                const videoResult = await this.downloadFile({
                    url: this.currentVideo.url,
                    quality: this.selectedVideoQuality.quality,
                    is_audio: false
                });
                downloads.push({ ...videoResult, type: 'video' });
            }

            // Download audio if needed
            if (this.downloadType === 'audio' || this.downloadType === 'both') {
                if (!this.selectedAudioQuality) throw new Error('No audio quality selected');
                
                this.progressStatus.textContent = 'Downloading audio...';
                const audioResult = await this.downloadFile({
                    url: this.currentVideo.url,
                    quality: this.selectedAudioQuality.quality,
                    is_audio: true
                });
                downloads.push({ ...audioResult, type: 'audio' });
            }

            this.downloadProgress.classList.add('hidden');
            this.downloadComplete.classList.remove('hidden');
            this.downloadedTitle.textContent = this.currentVideo.title;

            // Render download buttons
            this.downloadFiles.innerHTML = downloads.map(d => `
                <a href="${d.url}" class="download-file-btn" download="${d.filename}">
                    <i class="fa-solid ${d.type === 'video' ? 'fa-video' : 'fa-music'}"></i>
                    <span>${d.type === 'video' ? 'Video' : 'Audio'} - ${d.filename}</span>
                </a>
            `).join('');

            // Add to history
            this.addToHistory({
                title: this.currentVideo.title,
                thumbnail: this.currentVideo.thumbnail,
                files: downloads.map(d => ({ filename: d.filename, url: d.url, type: d.type })),
                date: new Date().toISOString()
            });

            this.showToast('Download complete!', false);
            
        } catch (error) {
            this.showToast(error.message);
            this.downloadProgress.classList.add('hidden');
            this.videoSection.classList.remove('hidden');
        }
    }

    async downloadFile(payload) {
        const response = await fetch('/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Download failed');
        }

        // Get filename from content-disposition header
        const disposition = response.headers.get('Content-Disposition');
        const filename = disposition 
            ? disposition.split('filename="')[1]?.replace('"', '') 
            : 'download';

        // Create blob and trigger download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Auto-trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { filename, url, success: true };
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

        this.historyList.innerHTML = this.downloads.map(item => {
            const files = item.files || [{ filename: item.filename, url: item.download_url, type: 'video' }];
            return `
                <div class="history-item">
                    <img src="${item.thumbnail}" alt="" class="history-thumb" onerror="this.style.display='none'">
                    <div class="history-details">
                        <div class="history-title">${item.title}</div>
                        <div class="history-meta">${files.map(f => f.type).join(' + ')} • ${this.timeAgo(item.date)}</div>
                    </div>
                    <div class="history-actions">
                        ${files.map(f => `
                            <a href="${f.url}" download="${f.filename}" title="Download ${f.type}">
                                <i class="fa-solid fa-${f.type === 'audio' ? 'music' : 'download'}"></i>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    clearHistory() {
        this.downloads = [];
        localStorage.removeItem('yt_downloads');
        this.renderHistory();
    }

    reset() {
        this.urlInput.value = '';
        this.currentVideo = null;
        this.selectedVideoQuality = null;
        this.selectedAudioQuality = null;
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

document.addEventListener('DOMContentLoaded', () => {
    new YouTubeDownloader();
});
