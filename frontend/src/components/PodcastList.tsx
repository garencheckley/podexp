import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Podcast } from '../types';
import { getAllPodcasts, deletePodcast } from '../services/api';

const PodcastList = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchPodcasts = async () => {
    try {
      const data = await getAllPodcasts();
      console.log('Fetched podcasts:', data);
      setPodcasts(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch podcasts. Please try again later.');
      console.error('Error fetching podcasts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPodcasts();
  }, []);

  const handleCreatePodcast = () => {
    navigate('/create-podcast');
  };

  const handleDeletePodcast = async (podcastId: string) => {
    if (window.confirm('Are you sure you want to delete this podcast? This will delete all episodes and audio files and cannot be undone.')) {
      setDeleting(podcastId);
      try {
        await deletePodcast(podcastId);
        // Refresh the podcast list
        fetchPodcasts();
      } catch (err) {
        setError('Failed to delete podcast. Please try again later.');
        console.error('Error deleting podcast:', err);
      } finally {
        setDeleting(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="container">
        <p>Loading podcasts...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Podcasts</h1>
        <button 
          onClick={handleCreatePodcast}
          className="create-button"
        >
          Create New Podcast
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {podcasts.length === 0 ? (
        <p>No podcasts found. Create your first podcast!</p>
      ) : (
        <div className="podcast-list">
          {podcasts.map(podcast => (
            <div key={podcast.id} className="podcast-card">
              <h2>{podcast.title}</h2>
              <p>{podcast.description}</p>
              <div className="podcast-actions">
                <Link to={`/podcasts/${podcast.id}`}>
                  <button>View Episodes</button>
                </Link>
                <button 
                  onClick={() => podcast.id && handleDeletePodcast(podcast.id)}
                  disabled={deleting === podcast.id}
                  className="delete-button"
                >
                  {deleting === podcast.id ? 'Deleting...' : 'Delete Podcast'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PodcastList; 