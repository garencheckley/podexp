import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Podcast } from '../types';
import { getAllPodcasts, deletePodcast } from '../services/api';

const PodcastList = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState<Record<string, boolean>>({});
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
        // Close the delete menu
        setShowDeleteMenu(prev => ({
          ...prev,
          [podcastId]: false
        }));
      }
    }
  };
  
  const toggleDeleteMenu = (podcastId: string) => {
    setShowDeleteMenu(prev => ({
      ...prev,
      [podcastId]: !prev[podcastId]
    }));
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h2>My Podcasts</h2>
        <button 
          onClick={handleCreatePodcast}
          className="create-button"
        >
          + Create New Podcast
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button 
            onClick={() => setError(null)} 
            className="error-dismiss"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {podcasts.length === 0 ? (
        <div className="empty-state">
          <h3>No podcasts yet</h3>
          <p>Create your first podcast to get started!</p>
          <button onClick={handleCreatePodcast} className="create-button">
            Create Your First Podcast
          </button>
        </div>
      ) : (
        <div className="podcast-list">
          {podcasts.map(podcast => (
            <div key={podcast.id} className="podcast-card">
              <h2>{podcast.title}</h2>
              <p>{podcast.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <Link to={`/podcasts/${podcast.id}`}>
                  <button>View Episodes</button>
                </Link>
                
                <div className="more-actions">
                  <button 
                    onClick={() => podcast.id && toggleDeleteMenu(podcast.id)}
                    className="more-button"
                    aria-label="Show delete option"
                  >
                    ⋮
                  </button>
                  
                  <div className={`actions-menu ${showDeleteMenu[podcast.id!] ? 'show' : ''}`}>
                    <div 
                      className="menu-item delete"
                      onClick={() => podcast.id && handleDeletePodcast(podcast.id)}
                    >
                      {deleting === podcast.id ? 'Deleting...' : 'Delete Podcast'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PodcastList; 