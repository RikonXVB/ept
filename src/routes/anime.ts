import { Elysia } from "elysia";
import { AnimeService } from "../services/anime";

export const animeRoutes = new Elysia({ prefix: '/api' })
  .get('/anime/:id', async ({ params }) => {
    try {
      const response = await fetch(`https://api.amvstr.me/api/v2/anime/${params.id}`);
      const data = await response.json();
      return data;
    } catch (error) {
      return { error: 'Failed to fetch anime data' };
    }
  })
  .get('/anime/:id/episodes/:episode', async ({ params }) => {
    try {
      const response = await fetch(`https://api.amvstr.me/api/v2/anime/${params.id}/${params.episode}`);
      const data = await response.json();
      return data;
    } catch (error) {
      return { error: 'Failed to fetch episode data' };
    }
  }); 