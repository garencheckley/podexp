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
  const [expandedEpisodes, setExpandedEpisodes] = useState<Record<string, boolean>>({});
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
      
      // Sort episodes by created_at in reverse chronological order
      const sortedEpisodes = [...episodesData].sort((a, b) => {
        return new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime();
      });
      
      setEpisodes(sortedEpisodes);
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
    
    // Clear any previous error before generating
    setError(null);
    setGenerating(true);
    try {
      const newEpisode = await generateEpisode(podcastId);
      setEpisodes(prevEpisodes => [newEpisode, ...prevEpisodes]);
    } catch (err) {
      // Show the detailed error message from the API
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate episode. Please try again later.';
      setError(errorMessage);
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

  const toggleEpisodeContent = (episodeId: string) => {
    setExpandedEpisodes(prev => ({
      ...prev,
      [episodeId]: !prev[episodeId]
    }));
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
        {error && (
          <div className="error-message" style={{ 
            backgroundColor: '#ffeded', 
            color: '#d32f2f', 
            padding: '0.75rem 1rem', 
            borderRadius: '4px', 
            marginTop: '1rem',
            marginBottom: '1rem'
          }}>
            {error}
            <button 
              onClick={() => setError(null)} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#d32f2f', 
                marginLeft: '0.5rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
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
                <div className="episode-actions">
                  <button 
                    onClick={() => episode.id && handleDeleteEpisode(episode.id)}
                    disabled={deleting === episode.id}
                    className="delete-button"
                  >
                    {deleting === episode.id ? 'Deleting...' : 'Delete Episode'}
                  </button>
                  {episode.audioUrl && (
                    <a 
                      href={episode.audioUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mp3-link"
                      style={{ marginLeft: '10px' }}
                    >
                      MP3 File
                    </a>
                  )}
                </div>
              </div>
              <p className="episode-description">{episode.description}</p>
              
              <div className="episode-content-container">
                <button 
                  onClick={() => episode.id && toggleEpisodeContent(episode.id)}
                  className="toggle-content-button"
                  style={{ 
                    background: 'none', 
                    color: '#4a7aeb', 
                    padding: '0.25rem 0.5rem',
                    marginBottom: '0.5rem'
                  }}
                >
                  {expandedEpisodes[episode.id!] ? 'Hide Transcript' : 'Show Transcript'}
                </button>
                
                {expandedEpisodes[episode.id!] && (
                  <p className="episode-content">{episode.content}</p>
                )}
              </div>
              
              {episode.audioUrl && (
                <div className="episode-audio">
                  <AudioPlayer audioUrl={episode.audioUrl} title={episode.title} />
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