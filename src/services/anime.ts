export interface VideoSource {
  sources: {
    url: string;
    quality: string;
    isM3U8: boolean;
  }[];
  subtitles?: {
    url: string;
    lang: string;
  }[];
}

export class AnimeService {
  private baseUrl = 'https://api.amvstr.me/api/v2';

  async getAnimeInfo(id: string) {
    const response = await fetch(`${this.baseUrl}/info/${id}`);
    return await response.json();
  }

  async getVideoSource(animeId: string, episode: string): Promise<VideoSource> {
    const response = await fetch(`${this.baseUrl}/stream/${animeId}/${episode}`);
    return await response.json();
  }
} 