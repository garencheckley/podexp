import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Stack,
  Divider,
  Paper,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  InputAdornment
} from '@mui/material';
import {
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Settings as SettingsIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  PlayArrow as PlayArrowIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Source as SourceIcon,
  Verified as VerifiedIcon,
  RssFeed as RssIcon,
  Autorenew as AutorenewIcon
} from '@mui/icons-material';
import { Podcast, Episode } from '../types';
import { getPodcast, getEpisodes, generateEpisode, deleteEpisode, regenerateAudio, updatePodcast, getEpisodeGenerationLogByEpisode, updatePodcastVisibility, getRssFeedUrl, getTopicOptions, TopicOption, TopicOptionsResponse } from '../services/api';
import AudioPlayer from './AudioPlayer';
import GenerationLogViewer from './GenerationLogViewer';
import VisibilityToggle from './VisibilityToggle';
import TopicSelector from './TopicSelector';
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
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuEpisodeId, setMenuEpisodeId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [episodeLength, setEpisodeLength] = useState(5); // Default to 5 minutes
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showTrustedSources, setShowTrustedSources] = useState(false);
  const [episodeGenerationLogs, setEpisodeGenerationLogs] = useState<Record<string, string>>({});
  const [activeEpisodeTabs, setActiveEpisodeTabs] = useState<Record<string, 'transcript' | 'log'>>({});
  const navigate = useNavigate();
  const [isOwner, setIsOwner] = useState(false);
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBackgroundGenNotice, setShowBackgroundGenNotice] = useState(false);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [rssCopied, setRssCopied] = useState(false);

  // Topic selection states
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [topicOptions, setTopicOptions] = useState<TopicOption[]>([]);
  const [fetchingTopics, setFetchingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TopicOption | null>(null);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [updatingAutoGenerate, setUpdatingAutoGenerate] = useState(false);

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
    if (podcast) {
      setAutoGenerate(podcast.autoGenerate || false);
    }
  }, [podcast]);

  // Set episode length default based on most recent episode
  useEffect(() => {
    if (episodes.length > 0) {
      const mostRecent = episodes[0];
      if (mostRecent && mostRecent.content) {
        const wordCount = mostRecent.content.split(/\s+/).length;
        const estimatedMinutes = Math.max(1, Math.round(wordCount / 130));
        setEpisodeLength(estimatedMinutes);
      }
    } else {
      setEpisodeLength(5); // fallback default
    }
  }, [episodes]);

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
    setError(null);
    setFetchingTopics(true);
    setShowBackgroundGenNotice(false);
    
    try {
      console.log('Fetching topic options...');
      const topicOptionsResponse = await getTopicOptions(podcastId);
      console.log('Received topic options response:', topicOptionsResponse);
      setTopicOptions(topicOptionsResponse.topicOptions);
      setShowTopicSelector(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get topic options. Please try again.';
      setError(errorMessage);
      console.error('Error fetching topic options:', err);
    } finally {
      setFetchingTopics(false);
    }
  };

  const handleTopicSelect = async (topic: TopicOption) => {
    if (!podcastId) return;
    setSelectedTopic(topic);
    setShowTopicSelector(false);
    setGenerating(true);
    setError(null);

    try {
      console.log('Generating episode with selected topic:', topic.topic);
      // Fire off the request but do not wait for completion
      generateEpisode(podcastId, { 
        targetMinutes: episodeLength,
        selectedTopic: topic 
      }).catch((err) => {
        // If the API call fails immediately, show error
        const errorMessage = err instanceof Error ? err.message : 'Failed to start episode generation. Please try again.';
        setError(errorMessage);
      });
      // Show background generation notice
      setShowBackgroundGenNotice(true);
    } finally {
      // Always stop loading after a short delay for UX
      setTimeout(() => setGenerating(false), 1000);
    }
  };

  const handleTopicTimeout = async () => {
    if (!podcastId || topicOptions.length === 0) return;
    
    // Auto-select the most relevant topic (first one)
    const autoSelectedTopic = topicOptions[0];
    console.log('Auto-selecting topic due to timeout:', autoSelectedTopic.topic);
    await handleTopicSelect(autoSelectedTopic);
  };

  const handleCancelTopicSelection = () => {
    setShowTopicSelector(false);
    setTopicOptions([]);
    setSelectedTopic(null);
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
        setMenuAnchorEl(null);
        setMenuEpisodeId(null);
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
      setMenuAnchorEl(null);
      setMenuEpisodeId(null);
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
    setMenuAnchorEl(null);
    setMenuEpisodeId(null);
  };
  
  const playEpisode = (episode: Episode) => {
    if (episode.audioUrl) {
      setCurrentAudio({
        url: episode.audioUrl,
        title: episode.title
      });
    }
  };
  
  const toggleMenu = (event: React.MouseEvent<HTMLElement>, episodeId: string) => {
    if (menuEpisodeId === episodeId) {
      setMenuAnchorEl(null);
      setMenuEpisodeId(null);
    } else {
      setMenuAnchorEl(event.currentTarget);
      setMenuEpisodeId(episodeId);
    }
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

  const handleCopyRss = () => {
    if (!podcast?.id) return;
    const rssUrl = getRssFeedUrl(podcast.id);
    navigator.clipboard.writeText(rssUrl).then(
      () => {
        setRssCopied(true);
        setTimeout(() => setRssCopied(false), 2000); // Revert after 2s
      },
      (err) => {
        console.error('Could not copy text: ', err);
        setError('Failed to copy RSS URL.');
      }
    );
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
    setMenuAnchorEl(null);
    setMenuEpisodeId(null);
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

  // Add handler for deleting the podcast
  const handleDeletePodcast = async () => {
    if (!podcastId) return;
    if (window.confirm('Are you sure you want to delete this podcast? This will delete all episodes and audio files and cannot be undone.')) {
      setDeleting(podcastId);
      try {
        await import('../services/api').then(api => api.deletePodcast(podcastId));
        navigate('/');
      } catch (err) {
        setError('Failed to delete podcast. Please try again later.');
        console.error('Error deleting podcast:', err);
      } finally {
        setDeleting(null);
      }
    }
  };

  const handleAutoGenerateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newAutoGenerate = event.target.checked;
    setAutoGenerate(newAutoGenerate); // Optimistically update UI
    setUpdatingAutoGenerate(true);
    setError(null);

    try {
      if (!podcastId) return;
      await updatePodcast(podcastId, { autoGenerate: newAutoGenerate });
      // Optionally show a success message
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update setting.';
      setError(errorMessage);
      setAutoGenerate(!newAutoGenerate); // Revert UI on error
    } finally {
      setUpdatingAutoGenerate(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error || !podcast) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2 }}>
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        >
          {error || 'Podcast not found'}
        </Alert>
        <Link to="/" className="back-button">
          ← Back to Home
        </Link>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pb: 10 }}>
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : podcast ? (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h4" component="h1">
                  {podcast.title}
                </Typography>
                
                {(isOwner || podcast.visibility === 'public') && (
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      onClick={(e) => setSettingsAnchorEl(e.currentTarget)}
                      aria-label="Settings"
                    >
                      <SettingsIcon />
                    </IconButton>
                    
                    <Menu
                      anchorEl={settingsAnchorEl}
                      open={Boolean(settingsAnchorEl)}
                      onClose={() => setSettingsAnchorEl(null)}
                    >
                      {isOwner && (
                        <MenuItem onClick={() => {
                          setShowSettings(true);
                          setSettingsAnchorEl(null);
                        }}>
                          <ListItemIcon>
                            <SettingsIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText>Podcast Settings</ListItemText>
                        </MenuItem>
                      )}
                      {(isOwner || podcast?.visibility === 'public') && (
                        <MenuItem component="a" href={getRssFeedUrl(podcast.id!)} target="_blank" rel="noopener noreferrer" onClick={() => setSettingsAnchorEl(null)}>
                          <ListItemIcon>
                            <RssIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText>View RSS Feed</ListItemText>
                        </MenuItem>
                      )}
                      {isOwner && (
                        <MenuItem onClick={() => {
                          handleDeletePodcast();
                          setSettingsAnchorEl(null);
                        }} sx={{ color: 'error.main' }}>
                          <ListItemIcon>
                            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                          </ListItemIcon>
                          <ListItemText>Delete Podcast</ListItemText>
                        </MenuItem>
                      )}
                    </Menu>
                  </Stack>
                )}
              </Stack>
              
              {editingPrompt ? (
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    label="Podcast Prompt"
                    disabled={savingPrompt}
                    sx={{ mb: 2 }}
                  />
                  
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      onClick={handleSavePrompt}
                      disabled={savingPrompt}
                      startIcon={<SaveIcon />}
                    >
                      Save
                    </Button>
                    
                    <Button
                      variant="outlined"
                      onClick={handleCancelEdit}
                      disabled={savingPrompt}
                      startIcon={<CancelIcon />}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Typography 
                  variant="body1" 
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {podcast.prompt}
                </Typography>
              )}
              
              {(isOwner || podcast?.visibility === 'public') && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RssIcon />}
                    onClick={handleCopyRss}
                    disabled={rssCopied}
                  >
                    {rssCopied ? 'Copied!' : 'Copy RSS Feed'}
                  </Button>
                </Box>
              )}
              
              {isOwner && (
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    variant="contained"
                    onClick={handleGenerateEpisode}
                    disabled={generating || fetchingTopics}
                    startIcon={fetchingTopics || generating ? <CircularProgress size={20} color="inherit" /> : null}
                  >
                    {fetchingTopics ? 'Getting Topics...' : (generating ? 'Starting...' : 'Generate Episode')}
                  </Button>
                  {isOwner && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoGenerate}
                          onChange={handleAutoGenerateChange}
                          name="autoGenerate"
                          color="primary"
                          disabled={updatingAutoGenerate}
                        />
                      }
                      label="Auto-generate every 3 days"
                    />
                  )}
                  <TextField
                    type="number"
                    label="Episode Length (minutes)"
                    value={episodeLength}
                    onChange={handleEpisodeLengthChange}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">min</InputAdornment>,
                    }}
                    sx={{ width: 200 }}
                    disabled={fetchingTopics || generating || showTopicSelector}
                  />
                </Stack>
              )}

              {!isOwner && podcast.autoGenerate && (
                <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 2 }}>
                  <AutorenewIcon fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    Auto-generates new episodes
                  </Typography>
                </Box>
              )}

              {showTopicSelector && (
                <TopicSelector
                  topicOptions={topicOptions}
                  onTopicSelect={handleTopicSelect}
                  onCancel={handleCancelTopicSelection}
                  onTimeout={handleTopicTimeout}
                  timeoutSeconds={90}
                />
              )}
              
              {showBackgroundGenNotice && (
                <Alert 
                  severity="info" 
                  sx={{ mt: 2 }}
                >
                  Episode generation has started in the background. This may take a few minutes. 
                  The page will automatically update when the episode is ready.
                </Alert>
              )}
            </CardContent>
          </Card>
          
          <Stack spacing={2}>
            {episodes.map((episode) => (
              <Card key={episode.id}>
                <CardContent>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6">
                          {episode.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                          {formatDateTime(episode.created_at!)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', mt: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => playEpisode(episode)}
                        startIcon={<PlayArrowIcon />}
                      >
                        Play
                      </Button>
                      {isOwner ? (
                        <IconButton
                          size="small"
                          onClick={(e) => { setMenuAnchorEl(e.currentTarget); setMenuEpisodeId(episode.id!); }}
                          aria-label="Episode options"
                          data-episode-id={episode.id}
                          sx={{ marginLeft: 'auto' }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      ) : (
                        <Box sx={{ width: 40, height: 40, marginLeft: 'auto' }} />
                      )}
                    </Box>
                  </Stack>
                  {expandedEpisodes[episode.id!] && (
                    <Box>
                      <Tabs
                        value={activeEpisodeTabs[episode.id!] || 'transcript'}
                        onChange={(_, value) => toggleEpisodeTab(episode.id!, value)}
                        sx={{ mb: 2 }}
                      >
                        <Tab value="transcript" label="Transcript" />
                        <Tab value="log" label="Generation Log" />
                      </Tabs>
                      {activeEpisodeTabs[episode.id!] === 'transcript' ? (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {episode.content}
                        </Typography>
                      ) : (
                        <GenerationLogViewer
                          episodeId={episode.id!}
                          logId={episodeGenerationLogs[episode.id!]}
                        />
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
            {/* Render the Menu once at the root, controlled by menuAnchorEl/menuEpisodeId */}
            <Menu
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl)}
              onClose={() => { setMenuAnchorEl(null); setMenuEpisodeId(null); }}
            >
              <MenuItem onClick={() => {
                if (menuEpisodeId) {
                  setExpandedEpisodes(prev => ({ ...prev, [menuEpisodeId]: true }));
                  setMenuAnchorEl(null);
                  setMenuEpisodeId(null);
                }
              }}>
                <ListItemIcon><ExpandMoreIcon fontSize="small" /></ListItemIcon>
                <ListItemText>View Details</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { if (menuEpisodeId) handleRegenerateAudio(menuEpisodeId); }}>
                <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Regenerate Audio</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { if (menuEpisodeId) handleDeleteEpisode(menuEpisodeId); }}>
                <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Delete Episode</ListItemText>
              </MenuItem>
            </Menu>
          </Stack>
        </>
      ) : null}
      
      {currentAudio && (
        <AudioPlayer
          audioUrl={currentAudio.url}
          title={currentAudio.title}
        />
      )}
    </Box>
  );
};

export default PodcastDetail;