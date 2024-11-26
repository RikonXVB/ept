/// <reference types="bun-types" />

import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { html } from '@elysiajs/html';
import { join } from "path";

const ANILIST_API = 'https://graphql.anilist.co';
const ANIWATCH_API = 'https://aniwatch-api-v1-0.onrender.com/api';

// GraphQL запросы
const POPULAR_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(sort: POPULARITY_DESC, type: ANIME) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
      }
      format
      episodes
      status
      averageScore
      description
    }
  }
}`;

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
      }
      format
      episodes
      status
      averageScore
      description
    }
  }
}`;

const ANIME_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title {
      romaji
      english
      native
    }
    coverImage {
      large
    }
    bannerImage
    format
    episodes
    status
    averageScore
    description
    genres
    studios {
      nodes {
        name
      }
    }
    startDate {
      year
    }
    duration
    source
    trailer {
      id
      site
    }
    streamingEpisodes {
      title
      thumbnail
      url
    }
  }
}`;

interface Track {
  file: string;
  label: string;
  kind: string;
}

interface Source {
  url: string;
  type: string;
}

interface RestRes {
  tracks: Track[];
  sources: Source[];
}

interface ServerResponse {
  restres: RestRes;
}

// Конфигурация прокси
const PROXY_URL = 'socks5://bQnNCTyF:vLP8Kfyw@154.222.207.2:64111';

async function fetchWithProxy(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

async function proxyVideo(url: string) {
  try {
    const response = await fetch(url);
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Proxy error', { status: 500 });
  }
}

interface Server {
  server: string;
  id: string;
  srcId: string;
  type?: string;
  lang?: string;
}

interface ServerData {
  sub?: Server[];
  dub?: Server[];
}

interface VideoSource {
  sources: {
    url: string;
    quality: string;
    isM3U8: boolean;
  }[];
  name: string | null;
  skips: {
    opening: number[];
    ending: number[];
  };
  preview: string | null;
}

interface AnilibriaTitle {
  id: number;
  code: string;
  names: {
    ru: string;
    en: string;
  };
  player: {
    alternative_player: string; // URL плеера
    playlist: {
      [key: string]: {
        serie: number;  // Номер серии
        created_timestamp: number;
        preview: string;
        skips: {
          opening: [number, number][];
          ending: [number, number][];
        };
        hls: {
          fhd: string;  // 1080p
          hd: string;   // 720p
          sd: string;   // 480p
        };
      };
    };
  };
}

const ANILIBRIA_API = 'https://api.anilibria.tv/v3';
const ANILIBRIA_CDN = 'https://static-libria.weekstorm.one';

// Добавим константы для таймаутов
const FETCH_TIMEOUT = 30000; // 30 секунд
const IDLE_TIMEOUT = 30000; // 30 секунд

// Создадим функцию для fetch с таймаутом
async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// Обновляем интерфейс для эпизода
interface AnilibriaEpisode {
  episode: number;
  name: string | null;
  uuid: string;
  created_timestamp: number;
  preview: string | null;
  skips: {
    opening: number[];
    ending: number[];
  };
  hls: {
    fhd: string | null;
    hd: string | null;
    sd: string | null;
  };
}

// Обновляем функцию получения видео
async function getVideoLinks(id: string, episode: number): Promise<VideoSource> {
  try {
    console.log('Получение данных аниме:', id, 'Эпизод:', episode);
    
    const response = await fetch(`${ANILIBRIA_API}/title?id=${id}`);
    if (!response.ok) {
      throw new Error(`API ответил с ошибкой: ${response.status}`);
    }

    const animeData = await response.json();
    console.log('Данные аниме получены:', animeData.names.ru);

    if (!animeData.player?.list) {
      throw new Error('Плеер недоступен');
    }

    const episodeData = animeData.player.list[episode];
    if (!episodeData) {
      throw new Error(`Эпизод ${episode} не найден`);
    }

    const host = animeData.player.host || 'cache.libria.fun';
    const qualities = [];

    if (episodeData.hls.fhd) {
      qualities.push({
        url: `https://${host}${episodeData.hls.fhd}`,
        quality: '1080p',
        isM3U8: true
      });
    }
    if (episodeData.hls.hd) {
      qualities.push({
        url: `https://${host}${episodeData.hls.hd}`,
        quality: '720p',
        isM3U8: true
      });
    }
    if (episodeData.hls.sd) {
      qualities.push({
        url: `https://${host}${episodeData.hls.sd}`,
        quality: '480p',
        isM3U8: true
      });
    }

    if (qualities.length === 0) {
      throw new Error('Нет доступных видео потоков');
    }

    return {
      sources: qualities,
      name: episodeData.name,
      skips: episodeData.skips,
      preview: episodeData.preview ? `https://${host}${episodeData.preview}` : null
    };
  } catch (error) {
    console.error('Ошибка получения видео:', error);
    throw error;
  }
}

async function fetchAnilist(query: string, variables: any) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  return response.json();
}

interface AnilibriaListRequest {
  limit?: number;
  after?: number;
  search?: string;
  sort?: string[];
  filter?: string[];
  include?: string[];
}

// Добавим константу для базового URL картинок
const ANILIBRIA_BASE_URL = 'https://api.anilibria.tv';

// Обновим функцию getAnilibriaList
async function getAnilibriaList(params: AnilibriaListRequest = {}) {
  try {
    const response = await fetch(`${ANILIBRIA_API}/title/updates?limit=${params.limit || 15}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API ответил с ошибкой: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка получения списка:', error);
    throw error;
  }
}

// В начале файла добавим интерфейс для конфигурации сервера
interface ServerConfig {
  port: number;
  hostname?: string;
  development?: boolean;
}

// Получаем порт из переменной окружения или используем 3000 как значение по умолчанию
const port = Number(process.env.PORT) || 3000;

const app = new Elysia()
  .use(cors())
  .use(html())
  .use(staticPlugin({
    assets: 'src/public',
    prefix: '/'
  }))
  .get("/", () => {
    const filePath = join(import.meta.dir, "public", "index.html");
    const file = Bun.file(filePath);
    return new Response(file);
  })
  .get("/anime/:id", ({ params: { id } }) => {
    if (!/^\d+$/.test(id)) {
      return new Response('Not Found', { status: 404 });
    }
    const filePath = join(import.meta.dir, "public", "anime.html");
    const file = Bun.file(filePath);
    return new Response(file);
  })
  .group("/api", app => app
    .get("/anime/popular", async ({ query }) => {
      try {
        const page = parseInt(query.page as string) || 1;
        const limit = parseInt(query.limit as string) || 100;
        const after = (page - 1) * limit;
        const year = query.year ? parseInt(query.year as string) : undefined;
        const season = query.season ? parseInt(query.season as string) : undefined;
        const genre = query.genre as string;

        // Формируем параметры фильтрации для API
        const filter = {
          season: season ? { code: season } : undefined,
          year: year,
          genres: genre ? [genre] : undefined
        };

        const data = await getAnilibriaList({ 
          limit,
          after,
          filter: ['id', 'names', 'posters', 'status', 'genres', 'season', 'type'],
          include: ['player'],
          ...(filter.season && { season: filter.season }),
          ...(filter.year && { year: filter.year }),
          ...(filter.genres && { genres: filter.genres })
        });
        
        return {
          results: data.list.map((anime: any) => ({
            id: anime.id,
            title: anime.names.ru,
            title_en: anime.names.en,
            code: anime.code,
            status: anime.status?.string || 'Неизвестно',
            image: anime.posters?.original?.url ? `${ANILIBRIA_CDN}${anime.posters.original.url}` : null,
            description: anime.description,
            episodes: `${anime.type?.episodes || '?'} эп.`,
            genres: Array.isArray(anime.genres) ? anime.genres : [],
            season: {
              year: anime.season?.year ? parseInt(anime.season.year) : null,
              code: anime.season?.code ? parseInt(anime.season.code) : null,
              string: anime.season?.string || ''
            }
          }))
        };
      } catch (error) {
        console.error('Ошибка получения популярных:', error);
        return { 
          error: true, 
          message: 'Ошибка при загрузке популярных аниме',
          results: [] 
        };
      }
    })
    .get("/anime/search/:query", async ({ params: { query } }) => {
      try {
        const searchQuery = decodeURIComponent(query);
        console.log('Поисковый запрос:', searchQuery);

        const response = await fetch(`${ANILIBRIA_API}/title/search?search=${encodeURIComponent(searchQuery)}&limit=100`, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`API ответил с ошибкой: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Результаты поиска:', data);

        return {
          results: (data.list || []).map((anime: any) => ({
            id: anime.id,
            title: anime.names.ru,
            title_en: anime.names.en,
            code: anime.code,
            status: anime.status?.string || 'Неизвестно',
            image: anime.posters?.original?.url ? `${ANILIBRIA_CDN}${anime.posters.original.url}` : null,
            description: anime.description,
            episodes: `${anime.type?.episodes || '?'} эп.`,
            genres: Array.isArray(anime.genres) ? anime.genres : [],
            season: {
              year: anime.season?.year ? parseInt(anime.season.year) : null,
              code: anime.season?.code ? parseInt(anime.season.code) : null,
              string: anime.season?.string || ''
            }
          }))
        };
      } catch (error) {
        console.error('Ошибка поиска:', error);
        return { 
          error: true, 
          message: error instanceof Error ? error.message : 'Ошибка при поиске',
          results: [] 
        };
      }
    })
    .get("/anime/:id", async ({ params: { id } }) => {
      try {
        // Используем API AniLibria вместо AniList
        const response = await fetch(`${ANILIBRIA_API}/title?id=${id}`);
        if (!response.ok) {
          throw new Error(`API ответил с ошибкой: ${response.status}`);
        }

        const anime = await response.json();
        
        // Формируем данные в нужном формате
        return {
          info: {
            title: anime.names.ru,
            title_en: anime.names.en,
            title_japanese: anime.names.alternative,
            synopsis: anime.description,
            image: anime.posters?.original?.url ? `${ANILIBRIA_CDN}${anime.posters.original.url}` : null,
            type: anime.type?.full_string || '',
            episodes: anime.type?.episodes || '?',
            status: anime.status?.string || 'Неизвестно',
            year: anime.season?.year,
            genres: anime.genres || [],
            season: {
              year: anime.season?.year,
              string: anime.season?.string
            }
          },
          // Формируем список эпизодов из player.list
          episodes: Object.entries(anime.player?.list || {}).map(([episodeNum, episodeData]: [string, any]) => ({
            id: episodeNum,
            title: episodeData.name,
            episode: parseInt(episodeNum),
            preview: episodeData.preview ? `${anime.player.host || 'cache.libria.fun'}${episodeData.preview}` : null
          })).sort((a, b) => a.episode - b.episode) // Сортируем эпизоды по номеру
        };
      } catch (error) {
        console.error("Anime info error:", error);
        return { 
          error: true, 
          message: error instanceof Error ? error.message : 'Ошибка при загрузке информации об аниме'
        };
      }
    })
    .get("/anime/:id/episode/:episode", async ({ params: { id, episode } }) => {
      try {
        // Сначала получаем информацию о тайтле
        const response = await fetch(`${ANILIBRIA_API}/title?id=${id}`);
        if (!response.ok) {
          throw new Error(`API ответил с ошибкой: ${response.status}`);
        }

        const animeData = await response.json();
        
        // Проверяем наличие плеера и серии
        if (!animeData.player?.list?.[episode]) {
          throw new Error('Эпизод не найден');
        }

        const episodeData = animeData.player.list[episode];
        const host = animeData.player.host || 'cache.libria.fun';

        // Формируем список качеств
        const sources = [];
        if (episodeData.hls.fhd) {
          sources.push({
            url: `https://${host}${episodeData.hls.fhd}`,
            quality: '1080p',
            isM3U8: true
          });
        }
        if (episodeData.hls.hd) {
          sources.push({
            url: `https://${host}${episodeData.hls.hd}`,
            quality: '720p',
            isM3U8: true
          });
        }
        if (episodeData.hls.sd) {
          sources.push({
            url: `https://${host}${episodeData.hls.sd}`,
            quality: '480p',
            isM3U8: true
          });
        }

        return {
          sources,
          name: episodeData.name,
          skips: episodeData.skips,
          preview: episodeData.preview ? `https://${host}${episodeData.preview}` : null
        };

      } catch (error) {
        console.error('Ошибка при получении эпизода:', error);
        return {
          error: true,
          message: error.message || 'Ошибка при загрузке эпизода'
        };
      }
    })
    .get("/proxy/video/*", async ({ request }) => {
      const url = new URL(request.url).pathname.replace('/proxy/video/', '');
      if (!url) {
        return new Response('URL not provided', { status: 400 });
      }
      const decodedUrl = decodeURIComponent(url);
      return proxyVideo(decodedUrl);
    })
    .get("/anime/filter", async ({ query }) => {
      try {
        const year = query.year ? parseInt(query.year as string) : undefined;
        const season_code = query.season_code ? parseInt(query.season_code as string) : undefined;
        const genres = query.genres as string;

        // Формируем параметры запроса к API AniLibria
        const params = new URLSearchParams();
        params.append('limit', '100');
        
        if (year) params.append('year', year.toString());
        if (season_code) params.append('season_code', season_code.toString());
        if (genres) params.append('genres', genres);

        const response = await fetch(`${ANILIBRIA_API}/title/search?${params.toString()}`, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`API ответил с ошибкой: ${response.status}`);
        }

        const data = await response.json();

        return {
          results: (data.list || []).map((anime: any) => ({
            id: anime.id,
            title: anime.names.ru,
            title_en: anime.names.en,
            code: anime.code,
            status: anime.status?.string || 'Неизвестно',
            image: anime.posters?.original?.url ? `${ANILIBRIA_CDN}${anime.posters.original.url}` : null,
            description: anime.description,
            episodes: `${anime.type?.episodes || '?'} эп.`,
            genres: Array.isArray(anime.genres) ? anime.genres : [],
            season: {
              year: anime.season?.year ? parseInt(anime.season.year) : null,
              code: anime.season?.code ? parseInt(anime.season.code) : null,
              string: anime.season?.string || ''
            }
          }))
        };
      } catch (error) {
        console.error('Ошибка фильтрации:', error);
        return { 
          error: true, 
          message: error instanceof Error ? error.message : 'Ошибка при фильтрации',
          results: [] 
        };
      }
    })
  )
  .listen({
    port: port,
    hostname: '0.0.0.0'
  });

console.log(`🦊 Сервер запущен на http://0.0.0.0:${app.server?.port}`); 