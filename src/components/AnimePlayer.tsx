import React, { useState, useEffect } from 'react';
import Plyr from 'plyr-react';
import { VideoSource } from '../services/anime';

interface AnimePlayerProps {
  animeId: string;
  episode: string;
}

const AnimePlayer: React.FC<AnimePlayerProps> = ({ animeId, episode }) => {
  const [videoData, setVideoData] = useState<VideoSource | null>(null);

  useEffect(() => {
    const loadVideo = async () => {
      try {
        const response = await fetch(`/api/anime/${animeId}/episodes/${episode}`);
        const data = await response.json();
        setVideoData(data);
      } catch (error) {
        console.error('Failed to load video:', error);
      }
    };
    
    loadVideo();
  }, [animeId, episode]);

  if (!videoData) return <div>Загрузка...</div>;

  return (
    <div className="player-wrapper">
      <Plyr
        source={{
          type: 'video',
          sources: videoData.sources.map(source => ({
            src: source.url,
            type: source.isM3U8 ? 'application/x-mpegURL' : 'video/mp4',
            size: parseInt(source.quality)
          }))
        }}
        options={{
          quality: {
            default: 720,
            options: [1080, 720, 480]
          }
        }}
      />
    </div>
  );
};

export default AnimePlayer; 