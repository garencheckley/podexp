import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Podcast } from '../types';
import { getAllPodcasts, deletePodcast, updatePodcastVisibility } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const PodcastList = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { isAuthenticated, userEmail, isLoading: authIsLoading } = useAuth();

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
    setLoading(true);
    fetchPodcasts();
  }, [isAuthenticated]);

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

  if (authIsLoading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  const handleVisibilityChange = async (podcastId: string, newVisibility: 'public' | 'private') => {
    const originalPodcasts = [...podcasts];
    setPodcasts(prevPodcasts =>
      prevPodcasts.map(p =>
        p.id === podcastId ? { ...p, visibility: newVisibility } : p
      )
    );
    setError(null);

    try {
      await updatePodcastVisibility(podcastId, newVisibility);
    } catch (err) {
      console.error('Failed to update visibility:', err);
      setError(`Failed to update visibility for podcast ${podcastId}. Please try refreshing.`);
      setPodcasts(originalPodcasts);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h2>{isAuthenticated ? 'My Podcasts' : 'Public Podcasts'}</h2>
        {isAuthenticated && (
          <button 
            onClick={handleCreatePodcast}
            className="create-button"
          >
            + Create New Podcast
          </button>
        )}
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

      {loading && !authIsLoading && podcasts.length === 0 && <p>Loading podcasts...</p>}

      {!loading && podcasts.length === 0 ? (
        <div className="empty-state">
          <h3>{isAuthenticated ? 'No podcasts yet' : 'No public podcasts found'}</h3>
          {isAuthenticated ? (
            <>
             <p>Create your first podcast to get started!</p>
             <button onClick={handleCreatePodcast} className="create-button">
               Create Your First Podcast
             </button>
            </>
          ) : (
            <p>Log in to create your own podcasts.</p>
          )}
        </div>
      ) : (
        <div className="podcast-list">
          {podcasts.map(podcast => {
            const isOwner = isAuthenticated && userEmail === podcast.ownerEmail;
            return (
              <div key={podcast.id} className="podcast-card">
                <div className="podcast-card-content">
                  <h2>{podcast.title}</h2>
                  
                  <div className="visibility-toggle-section list-toggle">
                     <label className="visibility-toggle-label">
                       <span>{podcast.visibility === 'public' ? 'Public' : 'Private'}</span>
                       {isOwner && (
                         <div className="toggle-switch">
                            <input
                              type="checkbox"
                              id={`visibility-toggle-list-${podcast.id}`}
                              checked={podcast.visibility === 'public'}
                              onChange={(e) => handleVisibilityChange(podcast.id!, e.target.checked ? 'public' : 'private')}
                            />
                            <span className="slider round"></span>
                         </div>
                       )}
                     </label>
                     {!isOwner && podcast.visibility === 'private' && (
                         <p className="visibility-note">This podcast is private.</p>
                     )}
                  </div>
                  
                  <p>{podcast.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <Link to={`/podcasts/${podcast.id}`}>
                      <button>View Episodes</button>
                    </Link>
                    
                    {isOwner && (
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
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PodcastList; 