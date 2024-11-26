let player = null;
let currentAnime = null;
let animePlayer = null;

async function loadAnimeDetails() {
    const container = document.querySelector('.episodes-list');
    currentAnime = window.location.pathname.split('/').pop();
    player = document.getElementById('player');

    try {
        const response = await fetch(`/api/anime/${currentAnime}`);
        const data = await response.json();

        if (!data.error) {
            // Заполняем информацию об аниме
            document.getElementById('animeTitle').textContent = data.info.title;
            document.getElementById('animeTitleEn').textContent = data.info.title_en;
            document.getElementById('animeYear').textContent = data.info.year;
            document.getElementById('animeType').textContent = data.info.type;
            document.getElementById('animeEpisodes').textContent = `${data.info.episodes} эп.`;
            document.getElementById('animeDescription').textContent = data.info.synopsis;
            document.getElementById('animeStatus').textContent = data.info.status;

            // Устанавливаем постер
            const posterImg = document.getElementById('animePoster');
            posterImg.src = data.info.image;
            posterImg.alt = data.info.title;

            // Устанавливаем фон
            const backdrop = document.querySelector('.anime-header-backdrop');
            backdrop.style.backgroundImage = `url(${data.info.image})`;

            // Добавляем жанры
            const genresContainer = document.getElementById('animeGenres');
            genresContainer.innerHTML = data.info.genres
                .map(genre => `<span>${genre}</span>`)
                .join('');

            // Создаем кнопки эпизодов
            container.innerHTML = Array.from({ length: data.info.episodes || 0 }, (_, i) => `
                <button 
                    class="episode-btn"
                    onclick="playEpisode(${i + 1})"
                >
                    ${i + 1}
                </button>
            `).join('');

            // Создаем плеер сразу
            animePlayer = new AnimePlayer(player);

            // Запускаем первый эпизод
            if (data.info.episodes > 0) {
                // Загружаем первый эпизод через ту же функцию, что используется для смены эпизодов
                await playEpisode(1);
                // Устанавливаем активную кнопку для первого эпизода
                document.querySelector('.episode-btn').classList.add('active');
            }
        } else {
            container.innerHTML = `<div class="error">${data.message || 'Ошибка при загрузке аниме'}</div>`;
        }
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div class="error">Произошла ошибка при загрузке</div>';
    }
}

async function playEpisode(episodeNumber) {
    if (!player || !currentAnime) return;

    // Обновляем активную кнопку
    document.querySelectorAll('.episode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === String(episodeNumber));
    });

    try {
        console.log(`Загрузка эпизода ${episodeNumber} для аниме ${currentAnime}`);
        const response = await fetch(`/api/anime/${currentAnime}/episode/${episodeNumber}`);
        const data = await response.json();
        console.log('Получены данные эпизода:', data);

        if (data.error) {
            throw new Error(data.message);
        }

        if (!data.sources?.length) {
            throw new Error('Нет доступных источников видео');
        }

        console.log('Доступные источники:', data.sources);

        // Загружаем источники в плеер
        animePlayer.loadSource(data.sources);

    } catch (error) {
        console.error('Ошибка при загрузке эпизода:', error);
        player.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i>
                Ошибка при загрузке видео: ${error.message}
            </div>
        `;
    }
}

function changeQuality(url) {
    const currentTime = document.getElementById('hlsPlayer').currentTime;
    if (window.currentHls) {
        window.currentHls.loadSource(url);
        window.currentHls.on(Hls.Events.MANIFEST_PARSED, function() {
            document.getElementById('hlsPlayer').currentTime = currentTime;
        });
    }
}

function skipOpening() {
    if (window.episodeData?.skips?.opening?.[1]) {
        document.getElementById('hlsPlayer').currentTime = window.episodeData.skips.opening[1];
    }
}

document.addEventListener('DOMContentLoaded', loadAnimeDetails); 