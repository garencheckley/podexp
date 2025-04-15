import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Podcast, Episode } from '../types';
import { getPodcast, getEpisodes, generateEpisode, deleteEpisode, regenerateAudio, updatePodcast } from '../services/api';
import AudioPlayer from './AudioPlayer';

const PodcastDetail = () => {
  const { podcastId } = useParams<{ podcastId: string }>();
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [regeneratingAudio, setRegeneratingAudio] = useState<string | null>(null);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Record<string, boolean>>({});
  const [currentAudio, setCurrentAudio] = useState<{url: string, title: string} | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [episodeLength, setEpisodeLength] = useState(3); // Default to 3 minutes
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showTrustedSources, setShowTrustedSources] = useState(false);
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

  useEffect(() => {
    // Update promptValue when podcast data is loaded
    if (podcast?.prompt) {
      setPromptValue(podcast.prompt);
    }
  }, [podcast]);

  const handleEpisodeLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setEpisodeLength(value);
    }
  };

  const decrementEpisodeLength = () => {
    if (episodeLength > 1) {
      setEpisodeLength(episodeLength - 1);
    }
  };

  const incrementEpisodeLength = () => {
    setEpisodeLength(episodeLength + 1);
  };

  const handleGenerateEpisode = async () => {
    if (!podcastId) return;
    
    // Clear any previous error before generating
    setError(null);
    setGenerating(true);
    try {
      const newEpisode = await generateEpisode(podcastId, episodeLength);
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
        
        // If the deleted episode was playing, stop playback
        if (currentAudio && episodes.find(ep => ep.id === episodeId)?.audioUrl === currentAudio.url) {
          setCurrentAudio(null);
        }
        
        setError(null);
      } catch (err) {
        setError('Failed to delete episode. Please try again later.');
        console.error('Error deleting episode:', err);
      } finally {
        setDeleting(null);
        // Close menu after deletion
        setOpenMenuId(null);
      }
    }
  };

  const handleRegenerateAudio = async (episodeId: string) => {
    if (!podcastId) return;
    
    setRegeneratingAudio(episodeId);
    setError(null);
    
    try {
      const updatedEpisode = await regenerateAudio(podcastId, episodeId);
      
      // Update the episode in the state with the new audio URL
      setEpisodes(prevEpisodes => 
        prevEpisodes.map(ep => 
          ep.id === episodeId ? updatedEpisode : ep
        )
      );
      
      // Close menu after action
      setOpenMenuId(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate audio';
      setError(errorMessage);
      console.error('Error regenerating audio:', err);
    } finally {
      setRegeneratingAudio(null);
    }
  };

  const toggleEpisodeContent = (episodeId: string) => {
    setExpandedEpisodes(prev => ({
      ...prev,
      [episodeId]: !prev[episodeId]
    }));
    // Close menu after action
    setOpenMenuId(null);
  };
  
  const playEpisode = (episode: Episode) => {
    if (episode.audioUrl) {
      setCurrentAudio({
        url: episode.audioUrl,
        title: episode.title
      });
    }
  };
  
  const toggleMenu = (episodeId: string) => {
    setOpenMenuId(openMenuId === episodeId ? null : episodeId);
  };

  const handleEditPrompt = () => {
    setEditingPrompt(true);
  };

  const handleSavePrompt = async () => {
    if (!podcastId || !podcast) return;
    
    setSavingPrompt(true);
    setError(null);
    
    try {
      const updatedPodcast = await updatePodcast(podcastId, { prompt: promptValue });
      setPodcast(updatedPodcast);
      setEditingPrompt(false);
    } catch (err) {
      setError('Failed to update podcast prompt. Please try again.');
      console.error('Error updating podcast prompt:', err);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleCancelEdit = () => {
    setPromptValue(podcast?.prompt || '');
    setEditingPrompt(false);
  };

  const toggleSourcesVisibility = (episodeId: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [episodeId]: !prev[episodeId]
    }));
  };

  const toggleTrustedSources = () => {
    setShowTrustedSources(!showTrustedSources);
  };

  // Helper function to format date with time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${formattedDate} at ${formattedTime}`;
  };

  // Helper function to calculate relative time
  const getRelativeTimeString = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
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

  if (error || !podcast) {
    return (
      <div className="container">
        <h2>{error || 'Podcast not found'}</h2>
        <Link to="/" className="back-button">
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <Link to="/" className="back-button">
        ← Back to Podcasts
      </Link>
      
      <div className="podcast-card">
        <h2>{podcast.title}</h2>
        <p>{podcast.description}</p>
        
        <div className="podcast-type-badge">
          <span className="badge news">News from the web</span>
        </div>
        
        <div className="podcast-sources-section">
          <div className="sources-header">
            <h3>Trusted Sources</h3>
            <button 
              onClick={toggleTrustedSources} 
              className="toggle-button"
              aria-label={showTrustedSources ? "Hide sources" : "Show sources"}
            >
              {showTrustedSources ? "Hide sources" : "Show sources"}
            </button>
          </div>
          
          {showTrustedSources && podcast.sources && podcast.sources.length > 0 && (
            <div className="trusted-sources-list">
              <table className="sources-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Category</th>
                    <th>Topics</th>
                    <th>Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {podcast.sources.map((source, index) => (
                    <tr key={index}>
                      <td>
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.name}
                        </a>
                      </td>
                      <td>{source.category}</td>
                      <td>{source.topicRelevance.join(', ')}</td>
                      <td>
                        <div className="quality-bar" style={{ 
                          width: `${source.qualityScore * 10}%`,
                          backgroundColor: source.qualityScore >= 8 ? '#4CAF50' : source.qualityScore >= 5 ? '#FFC107' : '#F44336'
                        }}></div>
                        <span className="quality-score">{source.qualityScore}/10</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="sources-info">
                These sources are automatically discovered based on the podcast theme and used to find relevant content when generating episodes.
              </p>
            </div>
          )}
          
          {showTrustedSources && (!podcast.sources || podcast.sources.length === 0) && (
            <p className="no-sources">No trusted sources configured for this podcast.</p>
          )}
        </div>
        
        <div className="podcast-prompt-section">
          <div className="prompt-header">
            <h3>Podcast Prompt</h3>
            {!editingPrompt && (
              <button 
                onClick={handleEditPrompt} 
                className="edit-button"
                aria-label="Edit prompt"
              >
                Edit
              </button>
            )}
          </div>
          
          {editingPrompt ? (
            <div className="prompt-editor">
              <textarea
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                rows={6}
                placeholder="Enter podcast prompt..."
                disabled={savingPrompt}
              />
              <div className="editor-actions">
                <button 
                  onClick={handleCancelEdit}
                  className="cancel-button"
                  disabled={savingPrompt}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSavePrompt}
                  className="save-button"
                  disabled={savingPrompt || !promptValue.trim()}
                >
                  {savingPrompt ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <p className="podcast-prompt">{podcast.prompt}</p>
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
        
        <div className="episode-length-control">
          <h3>Episode Length</h3>
          <div className="length-input-container">
            <button 
              className="length-button"
              onClick={decrementEpisodeLength}
              disabled={episodeLength <= 1 || generating}
              aria-label="Decrease episode length"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              value={episodeLength}
              onChange={handleEpisodeLengthChange}
              className="length-input"
              disabled={generating}
            />
            <button 
              className="length-button"
              onClick={incrementEpisodeLength}
              disabled={generating}
              aria-label="Increase episode length"
            >
              +
            </button>
            <span className="length-label">minutes</span>
          </div>
          <p className="length-help">Determines the duration of the generated episode. Longer episodes will have more content.</p>
        </div>
        
        <button 
          onClick={handleGenerateEpisode} 
          disabled={generating}
          style={{ marginTop: '1rem' }}
        >
          {generating ? 'Generating Episode...' : 'Generate New Episode'}
        </button>
      </div>
      
      <div className="episode-list">
        {episodes.length === 0 ? (
          <div className="empty-state">
            <h3>No episodes yet</h3>
            <p>Generate your first episode to get started!</p>
          </div>
        ) : (
          episodes.map(episode => (
            <div key={episode.id} className="episode-item">
              <div className="episode-header">
                <h3 className="episode-title">{episode.title}</h3>
                
                <div className="episode-actions">
                  {episode.audioUrl && (
                    <button 
                      onClick={() => playEpisode(episode)}
                      className="play-episode-button"
                      aria-label="Play Episode"
                    >
                      <span className="play-icon">▶</span>
                      Play Episode
                    </button>
                  )}
                  
                  <div className="more-actions">
                    <button 
                      onClick={() => episode.id && toggleMenu(episode.id)}
                      className="more-button"
                      aria-label="More actions"
                    >
                      ⋮
                    </button>
                    
                    <div className={`actions-menu ${openMenuId === episode.id ? 'show' : ''}`}>
                      <div 
                        className="menu-item"
                        onClick={() => episode.id && toggleEpisodeContent(episode.id)}
                      >
                        {expandedEpisodes[episode.id!] ? 'Hide Transcript' : 'Show Transcript'}
                      </div>
                      
                      {episode.audioUrl && (
                        <a 
                          href={episode.audioUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="menu-item"
                        >
                          Download MP3
                        </a>
                      )}
                      
                      <div 
                        className="menu-item"
                        onClick={() => episode.id && handleRegenerateAudio(episode.id)}
                      >
                        {regeneratingAudio === episode.id ? 'Regenerating...' : 'Regenerate Audio'}
                      </div>
                      
                      <div 
                        className="menu-item delete"
                        onClick={() => episode.id && handleDeleteEpisode(episode.id)}
                      >
                        {deleting === episode.id ? 'Deleting...' : 'Delete Episode'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="episode-description">{episode.description}</p>
              
              <div className="episode-content" style={{ display: expandedEpisodes[episode.id!] ? 'block' : 'none' }}>
                {episode.content.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
                
                {episode.sources && episode.sources.length > 0 && (
                  <div className="episode-sources">
                    <div className="sources-header">
                      <h4>Sources:</h4>
                      <button 
                        onClick={() => episode.id && toggleSourcesVisibility(episode.id)}
                        className="toggle-sources-button"
                        aria-label={expandedSources[episode.id!] ? "Hide sources" : "Show all sources"}
                      >
                        {expandedSources[episode.id!] ? "Hide sources" : "Show all sources"}
                      </button>
                    </div>
                    
                    {expandedSources[episode.id!] && (
                      <ul>
                        {episode.sources.map((source, index) => (
                          <li key={index}>
                            <a href={source} target="_blank" rel="noopener noreferrer">
                              {(() => {
                                try {
                                  const url = new URL(source);
                                  // Check if it's a vertexaisearch URL (which isn't very useful to display)
                                  if (url.hostname.includes('vertexaisearch.cloud.google.com')) {
                                    return `Reference ${index + 1}`;
                                  }
                                  // For normal URLs, show the hostname with protocol stripped
                                  return url.hostname;
                                } catch (e) {
                                  // If URL parsing fails, just show the source directly
                                  return source;
                                }
                              })()}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    {!expandedSources[episode.id!] && (
                      <p className="sources-summary">
                        {episode.sources.length} {episode.sources.length === 1 ? 'source' : 'sources'} available
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="episode-meta">
                Created: {episode.created_at && 
                  `${getRelativeTimeString(episode.created_at)} (${formatDateTime(episode.created_at)})`
                }
              </div>
            </div>
          ))
        )}
      </div>
      
      {currentAudio && (
        <AudioPlayer 
          audioUrl={currentAudio.url} 
          title={currentAudio.title} 
        />
      )}
    </div>
  );
};

export default PodcastDetail; 