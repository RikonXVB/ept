let player = null;
let currentAnime = null;
let currentAnimeList = []; // Сохраняем полный список аниме
let currentPage = 1;
const itemsPerPage = 100;
let isLoading = false;
let hasMoreItems = true;

async function loadPopularAnime(page = 1) {
    if (isLoading || (!hasMoreItems && page > 1)) return;
    
    const container = document.getElementById('animeList');
    if (page === 1) {
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <div>Загрузка популярных аниме...</div>
            </div>
        `;
    } else {
        // Добавляем индикатор загрузки в конец списка
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-more';
        loadingDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <div>Загрузка...</div>
        `;
        container.appendChild(loadingDiv);
    }

    isLoading = true;

    try {
        const response = await fetch(`/api/anime/popular?page=${page}&limit=${itemsPerPage}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            if (page === 1) {
                currentAnimeList = data.results;
                container.innerHTML = '';
            } else {
                currentAnimeList = [...currentAnimeList, ...data.results];
                // Удаляем индикатор загрузки
                const loadingMore = container.querySelector('.loading-more');
                if (loadingMore) loadingMore.remove();
            }

            // Добавляем новые карточки
            const newCards = data.results.map(anime => createAnimeCard(anime)).join('');
            container.insertAdjacentHTML('beforeend', newCards);

            if (page === 1) {
                updateFilterOptions();
            }

            hasMoreItems = data.results.length === itemsPerPage;
            currentPage = page;
        } else {
            hasMoreItems = false;
            if (page === 1) {
                container.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-circle"></i>
                        Не удалось загрузить аниме
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error:', error);
        if (page === 1) {
            container.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    Произошла ошибка при загрузке
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

let searchTimeout;

function searchAnime() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        loadPopularAnime();
        return;
    }

    const container = document.getElementById('animeList');
    container.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <div>Поиск аниме...</div>
        </div>
    `;

    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
        fetch(`/api/anime/search/${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.message);
                }

                if (data.results && data.results.length > 0) {
                    currentAnimeList = data.results;
                    container.innerHTML = '';
                    data.results.forEach(anime => {
                        container.insertAdjacentHTML('beforeend', createAnimeCard(anime));
                    });
                    updateFilterOptions();
                } else {
                    container.innerHTML = `
                        <div class="message-container">
                            <div class="error">
                                <i class="fas fa-search"></i>
                                Ничего не найдено по запросу "${query}"
                            </div>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Search error:', error);
                container.innerHTML = `
                    <div class="message-container">
                        <div class="error">
                            <i class="fas fa-exclamation-circle"></i>
                            Ошибка при поиске: ${error.message}
                        </div>
                    </div>
                `;
            });
    }, 300);
}

// Добавляем обработчики событий для поиска
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.querySelector('.search-button');

    // Поиск при вводе текста
    searchInput.addEventListener('input', searchAnime);

    // Поиск при нажатии на кнопку
    searchButton.addEventListener('click', searchAnime);

    // Поиск при нажатии Enter
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchAnime();
        }
    });
});

function displayResults(results) {
    const container = document.getElementById('animeList');
    container.innerHTML = results.map(anime => `
        <div class="anime-card" onclick="location.href='/anime/${anime.id}'">
            <div class="anime-card-image">
                <img 
                    src="${anime.image || './placeholder.jpg'}" 
                    alt="${anime.title}"
                    onerror="this.onerror=null; this.src='./placeholder.jpg';"
                    loading="lazy"
                >
                <div class="anime-status">${anime.status}</div>
                ${anime.episodes ? `<div class="anime-episodes-count">${anime.episodes}</div>` : ''}
            </div>
            <div class="anime-info">
                <div class="anime-title">${anime.title}</div>
                ${anime.title_en ? `<div class="anime-title-en">${anime.title_en}</div>` : ''}
                <div class="anime-season">
                    ${anime.season?.year ? `${anime.season.year} ` : ''}${anime.season?.string || ''}
                </div>
                ${anime.genres?.length ? `
                    <div class="anime-genres">
                        ${anime.genres.slice(0, 3).join(' • ')}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Загружаем популярные аниме при загрузке страницы
document.addEventListener('DOMContentLoaded', loadPopularAnime); 

async function applyFilters() {
    const genreFilter = document.getElementById('genreFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    const seasonFilter = document.getElementById('seasonFilter').value;

    const container = document.getElementById('animeList');
    container.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <div>Применение фильтров...</div>
        </div>
    `;

    try {
        // Формируем URL с параметрами фильтрации
        const params = new URLSearchParams();
        if (yearFilter) params.append('year', yearFilter);
        if (seasonFilter) params.append('season_code', seasonFilter);
        if (genreFilter) params.append('genres', genreFilter);
        
        // Добавляем параметры для получения полного списка
        params.append('limit', '100');

        const response = await fetch(`/api/anime/filter?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.message);
        }

        if (data.results && data.results.length > 0) {
            currentAnimeList = data.results;
            displayResults(data.results);
            updateFilterOptions();
        } else {
            container.innerHTML = `
                <div class="message-container">
                    <div class="error">
                        <i class="fas fa-filter"></i>
                        Ничего не найдено с выбранными фильтрами
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `
            <div class="message-container">
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    Ошибка при применении фильтров: ${error.message}
                </div>
            </div>
        `;
    }
} 

// Обновим функцию обновления фильтров
function updateFilterOptions() {
    const years = new Set();
    const genres = new Set();
    const seasons = new Map([
        [1, 'Зима'],
        [2, 'Весна'],
        [3, 'Лето'],
        [4, 'Осень']
    ]);

    // Сначала соберем все доступные значения
    currentAnimeList.forEach(anime => {
        if (anime.season?.year) {
            years.add(parseInt(anime.season.year));
        }
        if (Array.isArray(anime.genres)) {
            anime.genres.forEach(genre => genres.add(genre));
        }
    });

    // Обновляем список годов
    const yearFilter = document.getElementById('yearFilter');
    yearFilter.innerHTML = '<option value="">Все годы</option>' + 
        Array.from(years)
            .sort((a, b) => b - a)
            .map(year => `<option value="${year}">${year}</option>`)
            .join('');

    // Обновляем список жанров
    const genreFilter = document.getElementById('genreFilter');
    genreFilter.innerHTML = '<option value="">Все жанры</option>' + 
        Array.from(genres)
            .sort()
            .map(genre => `<option value="${genre}">${genre}</option>`)
            .join('');

    // Обновляем список сезонов
    const seasonFilter = document.getElementById('seasonFilter');
    seasonFilter.innerHTML = '<option value="">Все сезоны</option>' + 
        Array.from(seasons.entries())
            .map(([code, name]) => `<option value="${code}">${name}</option>`)
            .join('');

    console.log('Доступные фильтры:', {
        years: Array.from(years),
        genres: Array.from(genres),
        seasons: Array.from(seasons.entries())
    });
} 

// Функция для создания HTML карточки аниме
function createAnimeCard(anime) {
    return `
        <div class="anime-card" onclick="location.href='/anime/${anime.id}'">
            <div class="anime-card-image">
                <img 
                    src="${anime.image || './placeholder.jpg'}" 
                    alt="${anime.title}"
                    onerror="this.onerror=null; this.src='./placeholder.jpg';"
                    loading="lazy"
                >
                <div class="anime-status">${anime.status}</div>
                ${anime.episodes ? `<div class="anime-episodes-count">${anime.episodes}</div>` : ''}
            </div>
            <div class="anime-info">
                <div class="anime-title">${anime.title}</div>
                ${anime.title_en ? `<div class="anime-title-en">${anime.title_en}</div>` : ''}
                <div class="anime-season">
                    ${anime.season?.year ? `${anime.season.year} ` : ''}${anime.season?.string || ''}
                </div>
                ${anime.genres?.length ? `
                    <div class="anime-genres">
                        ${anime.genres.slice(0, 3).join(' • ')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Добавляем обработчик прокрутки для бесконечной загрузки
window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        if (!isLoading && hasMoreItems) {
            loadPopularAnime(currentPage + 1);
        }
    }
}); 