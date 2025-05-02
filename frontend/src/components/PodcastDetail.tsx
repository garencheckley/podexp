import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Podcast, Episode } from '../types';
import { getPodcast, getEpisodes, generateEpisode, deleteEpisode, regenerateAudio, updatePodcast, getEpisodeGenerationLogByEpisode, updatePodcastVisibility } from '../services/api';
import AudioPlayer from './AudioPlayer';
import GenerationLogViewer from './GenerationLogViewer';
import VisibilityToggle from './VisibilityToggle';
import { useAuth } from '../contexts/AuthContext';

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
  const [episodeGenerationLogs, setEpisodeGenerationLogs] = useState<Record<string, string>>({});
  const [activeEpisodeTabs, setActiveEpisodeTabs] = useState<Record<string, 'transcript' | 'log'>>({});
  const navigate = useNavigate();
  const [isOwner, setIsOwner] = useState(false);
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);

  // Get the current user's email (for ownership check)
  const { userEmail } = useAuth();

  const fetchData = async () => {
    if (!podcastId) return;

    try {
      setLoading(true);
      const podcastData = await getPodcast(podcastId);
      setPodcast(podcastData);
      
      // Check if the current user is the owner
      setIsOwner(!!userEmail && userEmail === podcastData?.ownerEmail);
      
      // Fetch episodes
      const episodesData = await getEpisodes(podcastId);
      setEpisodes(episodesData);
      
      // Sort episodes by created_at in reverse chronological order
      const sortedEpisodes = [...episodesData].sort((a, b) => {
        return new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime();
      });
      
      setEpisodes(sortedEpisodes);
      
      // Attempt to load generation logs for all episodes
      
      // Initialize all tabs to transcript by default
      const initialTabStates: Record<string, 'transcript' | 'log'> = {};
      
      for (const episode of sortedEpisodes) {
        if (episode.id) {
          initialTabStates[episode.id] = 'transcript';
          
          // Try to fetch the generation log for this episode in the background
          getEpisodeGenerationLogByEpisode(episode.id)
            .then(log => {
              if (log && log.id) {
                console.log(`Found generation log ${log.id} for episode ${episode.id}`);
                setEpisodeGenerationLogs(prev => ({
                  ...prev,
                  [episode.id!]: log.id
                }));
              }
            })
            .catch(err => {
              console.log(`No generation log found for episode ${episode.id}:`, err);
            });
        }
      }
      
      // Set initial tab states
      setActiveEpisodeTabs(initialTabStates);
      
      setError(null);
    } catch (err) {
      // Type assertion for error handling
      const error = err as Error;
      setError(`Failed to fetch podcast data: ${error.message || 'Please try again later.'}`);
      console.error('Error fetching podcast data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if podcastId is defined
    if (podcastId) {
        fetchData();
    }
  }, [podcastId, userEmail]);

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
      console.log('Generating episode for podcast:', podcastId, 'with length:', episodeLength);
      const result = await generateEpisode(podcastId, { targetMinutes: episodeLength });
      console.log('Generated episode result (full):', JSON.stringify(result, null, 2));
      console.log('Episode ID:', result.episode.id);
      console.log('Generation log ID:', result.generationLogId);
      
      // Make sure we have a valid episode id and generation log id
      if (!result.episode.id || !result.generationLogId) {
        console.error('Missing episode ID or generation log ID in response');
      } else {
        console.log(`Setting generation log ID ${result.generationLogId} for episode ${result.episode.id}`);
        
        // Update episodeGenerationLogs state
        setEpisodeGenerationLogs(prev => {
          const updated = {
            ...prev,
            [result.episode.id!]: result.generationLogId
          };
          console.log('Updated episodeGenerationLogs state:', updated);
          return updated;
        });
        
        // Initialize the tab state to transcript by default
        setActiveEpisodeTabs(prev => ({
          ...prev,
          [result.episode.id!]: 'transcript'
        }));
      }
      
      // Add new episode to the list
      setEpisodes(prevEpisodes => [result.episode, ...prevEpisodes]);
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

  const toggleEpisodeTab = (episodeId: string, tab: 'transcript' | 'log') => {
    console.log('Toggling tab for episode:', episodeId, 'to:', tab);
    console.log('Generation log ID for this episode:', episodeGenerationLogs[episodeId]);
    
    setActiveEpisodeTabs(prev => ({
      ...prev,
      [episodeId]: tab
    }));
    
    // Automatically expand the episode when switching to a tab
    if (!expandedEpisodes[episodeId]) {
      setExpandedEpisodes(prev => ({
        ...prev,
        [episodeId]: true
      }));
    }
    
    // Close menu after tab switch
    setOpenMenuId(null);
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

  // Handler for the INLINE visibility toggle input
  const handleVisibilityChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!podcast || !podcast.id || !isOwner) return;

    const newVisibility = event.target.checked ? 'public' : 'private';
    const originalVisibility = podcast.visibility;

    // Optimistic UI update
    setPodcast(prev => prev ? { ...prev, visibility: newVisibility } : null);
    setVisibilityUpdating(true);
    setError(null); // Clear previous errors

    try {
      await updatePodcastVisibility(podcast.id, newVisibility);
      // Update successful, state already reflects the change
      console.log(`Podcast visibility updated to ${newVisibility}`);
    } catch (err) {
      // Type assertion for error handling
      const error = err as Error;
      console.error('Failed to update visibility:', error);
      setError(`Failed to update visibility: ${error.message || 'Please try again.'}`);
      // Revert optimistic update on error
      setPodcast(prev => prev ? { ...prev, visibility: originalVisibility } : null);
    } finally {
      setVisibilityUpdating(false);
    }
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
        
        {/* --- Visibility Toggle (Inline Implementation) --- */}
        {/* Only show if owner */}
        {isOwner && (
          <div className="visibility-toggle-section">
            <label className="visibility-toggle-label">
              <span>{podcast.visibility === 'public' ? 'Public' : 'Private'}</span>
              <div className="toggle-switch">
                 <input
                   type="checkbox"
                   id={`visibility-toggle-${podcast.id}`}
                   checked={podcast.visibility === 'public'}
                   onChange={handleVisibilityChange}
                   disabled={visibilityUpdating}
                 />
                 <span className="slider round"></span>
              </div>
              {visibilityUpdating && <span className="updating-indicator">(updating...)</span>}
            </label>
            <p className="visibility-note">
              {podcast.visibility === 'public'
                ? 'Anyone logged in can see this podcast.'
                : 'Only you can see this podcast.'}
            </p>
          </div>
        )}
        {/* --- End Visibility Toggle --- */}
        
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
        
        {/* --- Edit Prompt Section --- */}
        <div className="podcast-prompt-section">
          <div className="prompt-header">
            <h3>Podcast Prompt</h3>
            {/* Only show Edit button if owner */}
            {isOwner && !editingPrompt && (
              <button 
                onClick={handleEditPrompt} 
                className="edit-button"
                aria-label="Edit prompt"
              >
                Edit
              </button>
            )}
          </div>
          {/* Show editor only if owner and editing */}
          {isOwner && editingPrompt ? (
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
        {/* --- End Edit Prompt Section --- */}
        
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
        
        {/* --- Generate Episode Section --- */}
        {/* Only show if owner */}
        {isOwner && (
           <div className="episode-generation-controls">
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
        )}
        {/* --- End Generate Episode Section --- */}
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
                  
                  {/* Only show episode menu button if owner */}
                  {isOwner && (
                    <div className="more-actions">
                      <button 
                        onClick={() => episode.id && toggleMenu(episode.id)}
                        className="more-button"
                        aria-label="More actions"
                      >
                        ⋮
                      </button>
                      {/* The menu itself needs no extra owner check, as button won't render */}
                      <div className={`actions-menu ${openMenuId === episode.id ? 'show' : ''}`}>
                        <div 
                          className="menu-item"
                          onClick={() => episode.id && toggleEpisodeContent(episode.id)}
                        >
                          {expandedEpisodes[episode.id!] ? 'Hide Transcript' : 'Show Transcript'}
                        </div>
                        
                        {episodeGenerationLogs[episode.id!] && (
                          <div 
                            className="menu-item"
                            onClick={() => {
                              if (episode.id) {
                                toggleEpisodeTab(episode.id, 'log');
                                if (!expandedEpisodes[episode.id]) {
                                  toggleEpisodeContent(episode.id);
                                }
                              }
                            }}
                          >
                            View Generation Log
                          </div>
                        )}
                        
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
                  )}
                </div>
              </div>
              
              <p className="episode-description">{episode.description}</p>
              
              {expandedEpisodes[episode.id!] && (
                <div className="episode-content-tabs">
                  <div className="tabs-header">
                    <button 
                      className={`tab-button ${activeEpisodeTabs[episode.id!] !== 'log' ? 'active' : ''}`}
                      onClick={() => episode.id && toggleEpisodeTab(episode.id, 'transcript')}
                    >
                      Transcript
                    </button>
                    {episodeGenerationLogs[episode.id!] && (
                      <button 
                        className={`tab-button ${activeEpisodeTabs[episode.id!] === 'log' ? 'active' : ''}`}
                        onClick={() => episode.id && toggleEpisodeTab(episode.id, 'log')}
                      >
                        Generation Log
                      </button>
                    )}
                  </div>
                  
                  <div className="tab-content">
                    {activeEpisodeTabs[episode.id!] === 'log' ? (
                      <div className="generation-log-tab">
                        {episodeGenerationLogs[episode.id!] ? (
                          <GenerationLogViewer 
                            logId={episodeGenerationLogs[episode.id!]} 
                            onError={(error) => {
                              console.error("Error loading generation log:", error);
                              // Reset to transcript tab on error
                              toggleEpisodeTab(episode.id!, 'transcript');
                            }}
                          />
                        ) : (
                          <div className="log-not-available">
                            <p>Generation log not available for this episode.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="transcript-tab">
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
                    )}
                  </div>
                </div>
              )}
              
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