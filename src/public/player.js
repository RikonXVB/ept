class AnimePlayer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.currentQuality = 0;
        this.currentTime = 0;
        this.hls = null;
        
        this.init();
    }

    init() {
        // Очищаем контейнер перед инициализацией
        this.container.innerHTML = '';
        
        // Создаем структуру плеера
        const playerHTML = `
            <div class="custom-player" style="display: block; width: 100%; height: 100%; position: relative;">
                <video id="hlsPlayer" crossorigin="anonymous" style="width: 100%; height: 100%; background: #000;">
                    <source type="application/x-mpegURL">
                    Your browser does not support HTML5 video.
                </video>
                <div class="controls" style="display: block; position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 20px;">
                    <div class="progress-bar">
                        <div class="progress"></div>
                        <div class="progress-hover"></div>
                    </div>
                    <div class="buttons">
                        <button class="play-button">
                            <i class="fas fa-play"></i>
                        </button>
                        <div class="volume-control">
                            <button class="volume-button">
                                <i class="fas fa-volume-up"></i>
                            </button>
                            <div class="volume-slider">
                                <input type="range" min="0" max="100" value="100" class="volume-range">
                            </div>
                        </div>
                        <div class="time">
                            <span class="current">0:00</span>
                            <span>/</span>
                            <span class="duration">0:00</span>
                        </div>
                        <div class="right-controls">
                            <select class="quality-selector"></select>
                            <button class="fullscreen-button">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.insertAdjacentHTML('beforeend', playerHTML);

        // Получаем ссылки на элементы управления
        this.video = this.container.querySelector('#hlsPlayer');
        this.playButton = this.container.querySelector('.play-button');
        this.volumeButton = this.container.querySelector('.volume-button');
        this.volumeRange = this.container.querySelector('.volume-range');
        this.volumeControl = this.container.querySelector('.volume-control');
        this.progressBar = this.container.querySelector('.progress-bar');
        this.progress = this.container.querySelector('.progress');
        this.progressHover = this.container.querySelector('.progress-hover');
        this.currentTimeDisplay = this.container.querySelector('.current');
        this.durationDisplay = this.container.querySelector('.duration');
        this.qualitySelector = this.container.querySelector('.quality-selector');
        this.fullscreenButton = this.container.querySelector('.fullscreen-button');

        this.addEventListeners();
    }

    addEventListeners() {
        // Воспроизведение/пауза
        this.playButton.addEventListener('click', () => this.togglePlay());
        this.video.addEventListener('click', () => this.togglePlay());

        // Обновление прогресса
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('loadedmetadata', () => this.updateDuration());

        // Перемотка
        this.progressBar.addEventListener('click', (e) => this.seek(e));
        this.progressBar.addEventListener('mousemove', (e) => this.showProgressHover(e));
        this.progressBar.addEventListener('mouseleave', () => this.hideProgressHover());

        // Полный экран
        this.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());

        // Качество видео
        this.qualitySelector.addEventListener('change', (e) => this.changeQuality(e.target.value));

        // Управление звуком
        this.volumeRange.addEventListener('input', (e) => this.changeVolume(e.target.value));
        this.volumeButton.addEventListener('click', () => this.toggleMute());
        
        // Обновление иконки звука при изменении громкости
        this.video.addEventListener('volumechange', () => this.updateVolumeIcon());

        this.video.addEventListener('loadeddata', () => {
            // Убираем индикатор загрузки после того как видео загрузилось
            const loadingIndicator = this.container.querySelector('.loading');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        });
    }

    loadSource(sources) {
        if (!sources || !sources.length) {
            console.error('Нет источников для загрузки');
            return;
        }

        console.log('Загрузка источников:', sources);
        this.sources = sources;
        this.currentQuality = 0;

        // Очищаем HLS если он существует
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();

        // Заполняем селектор качества
        this.qualitySelector.innerHTML = sources.map((source, index) => 
            `<option value="${index}">${source.quality}</option>`
        ).join('');

        if (Hls.isSupported()) {
            console.log('HLS поддерживается');
            
            this.hls = new Hls({
                enableWorker: true,
                debug: false
            });

            // Добавляем обработчик для обновления длительности
            this.video.addEventListener('loadedmetadata', () => {
                console.log('Метаданные загружены');
                this.updateDuration();
                this.currentTimeDisplay.textContent = '0:00';
            }, { once: true }); // once: true означает, что обработчик сработает только один раз

            this.hls.attachMedia(this.video);

            this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                console.log('HLS прикреплен к видео элементу');
                this.hls.loadSource(sources[0].url);
            });

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('Manifest загружен, готов к воспроизведению');
                // Обновляем длительность после загрузки манифеста
                this.updateDuration();
            });

        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = sources[0].url;
            
            // Добавляем обработчик для нативной поддержки HLS
            this.video.addEventListener('loadedmetadata', () => {
                console.log('Метаданные загружены (нативный HLS)');
                this.updateDuration();
                this.currentTimeDisplay.textContent = '0:00';
            }, { once: true });
        }
    }

    togglePlay() {
        if (this.video.paused) {
            this.video.play();
            this.playButton.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            this.video.pause();
            this.playButton.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    updateProgress() {
        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.progress.style.width = `${progress}%`;
        this.currentTimeDisplay.textContent = this.formatTime(this.video.currentTime);
    }

    updateDuration() {
        if (!isNaN(this.video.duration)) {
            this.durationDisplay.textContent = this.formatTime(this.video.duration);
            console.log('Длительность обновлена:', this.video.duration);
        } else {
            console.log('Длительность пока недоступна');
        }
    }

    seek(event) {
        const percent = event.offsetX / this.progressBar.offsetWidth;
        this.video.currentTime = percent * this.video.duration;
    }

    showProgressHover(event) {
        const percent = event.offsetX / this.progressBar.offsetWidth;
        this.progressHover.style.width = `${percent * 100}%`;
    }

    hideProgressHover() {
        this.progressHover.style.width = '0';
    }

    changeQuality(index) {
        if (index === this.currentQuality || !this.sources[index]) return;

        const source = this.sources[index];
        const currentTime = this.video.currentTime;
        const wasPlaying = !this.video.paused;
        this.currentQuality = index;

        // Очищаем текущее видео и HLS
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        if (Hls.isSupported()) {
            this.hls = new Hls({
                enableWorker: true,
                debug: false
            });

            this.hls.attachMedia(this.video);

            this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                this.hls.loadSource(source.url);
            });

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.video.currentTime = currentTime;
                if (wasPlaying) {
                    this.video.play();
                }
            });
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = source.url;
            this.video.currentTime = currentTime;
            if (wasPlaying) {
                this.video.play();
            }
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen();
            this.fullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            document.exitFullscreen();
            this.fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    changeVolume(value) {
        const volume = value / 100;
        this.video.volume = volume;
        this.volumeRange.value = value;
        this.updateVolumeIcon();
    }

    toggleMute() {
        this.video.muted = !this.video.muted;
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        const volume = this.video.volume;
        const isMuted = this.video.muted;
        let iconClass = 'fa-volume-up';
        
        if (isMuted || volume === 0) {
            iconClass = 'fa-volume-mute';
        } else if (volume < 0.5) {
            iconClass = 'fa-volume-down';
        }

        this.volumeButton.innerHTML = `<i class="fas ${iconClass}"></i>`;
    }
} 