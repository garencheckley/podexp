import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Podcast, Episode } from '../types';
import { getPodcast, getEpisodes, generateEpisode, deleteEpisode } from '../services/api';
import AudioPlayer from './AudioPlayer';

const PodcastDetail = () => {
  const { podcastId } = useParams<{ podcastId: string }>();
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    if (!podcastId) return;

    try {
      const [podcastData, episodesData] = await Promise.all([
        getPodcast(podcastId),
        getEpisodes(podcastId)
      ]);
      console.log('Fetched podcast data:', podcastData);
      setPodcast(podcastData);
      setEpisodes(episodesData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch podcast data. Please try again later.');
      console.error('Error fetching podcast data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [podcastId]);

  const handleGenerateEpisode = async () => {
    if (!podcastId) return;
    
    setGenerating(true);
    try {
      const newEpisode = await generateEpisode(podcastId);
      setEpisodes(prevEpisodes => [newEpisode, ...prevEpisodes]);
      setError(null);
    } catch (err) {
      setError('Failed to generate episode. Please try again later.');
      console.error('Error generating episode:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!podcastId) return;
    
    if (window.confirm('Are you sure you want to delete this episode? This will also delete the associated audio file and cannot be undone.')) {
      setDeleting(episodeId);
      try {
        await deleteEpisode(podcastId, episodeId);
        // Remove the episode from the state
        setEpisodes(prevEpisodes => prevEpisodes.filter(episode => episode.id !== episodeId));
        setError(null);
      } catch (err) {
        setError('Failed to delete episode. Please try again later.');
        console.error('Error deleting episode:', err);
      } finally {
        setDeleting(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="container">
        <p>Loading podcast...</p>
      </div>
    );
  }

  if (error || !podcast) {
    return (
      <div className="container">
        <h2>{error || 'Podcast not found'}</h2>
        <Link to="/">
          <button>Back to Home</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="podcast-card">
        <h2>{podcast.title}</h2>
        <p>{podcast.description}</p>
        <button 
          onClick={handleGenerateEpisode} 
          disabled={generating}
          style={{ marginTop: '1rem' }}
        >
          {generating ? 'Generating...' : 'Generate New Episode'}
        </button>
      </div>
      
      <div className="episode-list">
        {episodes.length === 0 ? (
          <p>No episodes found.</p>
        ) : (
          episodes.map(episode => (
            <div key={episode.id} className="episode-item">
              <div className="episode-header">
                <h3 className="episode-title">{episode.title}</h3>
                <button 
                  onClick={() => episode.id && handleDeleteEpisode(episode.id)}
                  disabled={deleting === episode.id}
                  className="delete-button"
                >
                  {deleting === episode.id ? 'Deleting...' : 'Delete Episode'}
                </button>
              </div>
              <p className="episode-description">{episode.description}</p>
              <p className="episode-content">{episode.content}</p>
              {episode.audioUrl && (
                <div className="episode-audio">
                  <AudioPlayer audioUrl={episode.audioUrl} title={episode.title} />
                  <div className="audio-url">
                    <p>Audio URL: <a href={episode.audioUrl} target="_blank" rel="noopener noreferrer">{episode.audioUrl}</a></p>
                  </div>
                </div>
              )}
              <div className="episode-meta">
                Created: {new Date(episode.created_at!).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <Link to="/">
          <button>Back to Home</button>
        </Link>
      </div>
    </div>
  );
};

export default PodcastDetail; 