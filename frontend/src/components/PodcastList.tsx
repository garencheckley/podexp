import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { 
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { Podcast } from '../types';
import { getAllPodcasts, deletePodcast, updatePodcastVisibility } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const PodcastList = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});
  const navigate = useNavigate();
  const { isAuthenticated, userEmail } = useAuth();

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
        fetchPodcasts();
      } catch (err) {
        setError('Failed to delete podcast. Please try again later.');
        console.error('Error deleting podcast:', err);
      } finally {
        setDeleting(null);
        setMenuAnchor(prev => ({ ...prev, [podcastId]: null }));
      }
    }
  };
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, podcastId: string) => {
    setMenuAnchor(prev => ({ ...prev, [podcastId]: event.currentTarget }));
  };

  const handleMenuClose = (podcastId: string) => {
    setMenuAnchor(prev => ({ ...prev, [podcastId]: null }));
  };

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
      handleMenuClose(podcastId);
    } catch (err) {
      console.error('Failed to update visibility:', err);
      setError(`Failed to update visibility for podcast ${podcastId}. Please try refreshing.`);
      setPodcasts(originalPodcasts);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4 
      }}>
        <Typography variant="h4" component="h1">
          {isAuthenticated ? 'My Podcasts' : 'Public Podcasts'}
        </Typography>
        {isAuthenticated && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreatePodcast}
            size="large"
          >
            Create New Podcast
          </Button>
        )}
      </Box>

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {loading && podcasts.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && podcasts.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            {isAuthenticated ? 'No podcasts yet' : 'No public podcasts found'}
          </Typography>
          {isAuthenticated ? (
            <>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Create your first podcast to get started!
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreatePodcast}
                size="large"
              >
                Create Your First Podcast
              </Button>
            </>
          ) : (
            <Typography color="text.secondary">
              Log in to create your own podcasts.
            </Typography>
          )}
        </Card>
      ) : (
        <Stack spacing={2}>
          {podcasts.map((podcast) => {
            if (!podcast.id) return null; // Skip podcasts without IDs
            const isOwner = isAuthenticated && userEmail === podcast.ownerEmail;
            const podcastId = podcast.id;
            return (
              <Card key={podcastId} elevation={1}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" gutterBottom>
                        {podcast.title}
                      </Typography>
                      <Typography color="text.secondary" paragraph>
                        {podcast.description}
                      </Typography>
                    </Box>
                    {isOwner && (
                      <IconButton onClick={(e) => handleMenuOpen(e, podcastId)}>
                        <MoreVertIcon />
                      </IconButton>
                    )}
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Button
                      component={Link}
                      to={`/podcasts/${podcastId}`}
                      variant="contained"
                      startIcon={<VisibilityIcon />}
                    >
                      View Episodes
                    </Button>
                    {isOwner && (
                      <Typography variant="body2" color="text.secondary">
                        {podcast.visibility === 'public' ? (
                          <PublicIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                        ) : (
                          <LockIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                        )}
                        {podcast.visibility}
                      </Typography>
                    )}
                  </Box>
                </CardContent>

                {isOwner && (
                  <Menu
                    anchorEl={menuAnchor[podcastId]}
                    open={Boolean(menuAnchor[podcastId])}
                    onClose={() => handleMenuClose(podcastId)}
                  >
                    <MenuItem 
                      onClick={() => handleVisibilityChange(podcastId, podcast.visibility === 'public' ? 'private' : 'public')}
                    >
                      <ListItemIcon>
                        {podcast.visibility === 'public' ? <LockIcon /> : <PublicIcon />}
                      </ListItemIcon>
                      <ListItemText>
                        Make {podcast.visibility === 'public' ? 'Private' : 'Public'}
                      </ListItemText>
                    </MenuItem>
                    <MenuItem 
                      onClick={() => handleDeletePodcast(podcastId)}
                      disabled={deleting === podcastId}
                    >
                      <ListItemIcon>
                        <DeleteIcon />
                      </ListItemIcon>
                      <ListItemText>
                        {deleting === podcastId ? 'Deleting...' : 'Delete Podcast'}
                      </ListItemText>
                    </MenuItem>
                  </Menu>
                )}
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default PodcastList; 