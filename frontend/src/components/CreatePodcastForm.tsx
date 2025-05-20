import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  Card, 
  CardContent,
  Link as MuiLink,
  CircularProgress
} from '@mui/material';
import { Link } from 'react-router-dom';
import { createPodcast } from '../services/api';
import { useNavigate } from 'react-router-dom';

const CreatePodcastForm: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  // Always use 'news' type, no longer offering a choice
  const podcastType = 'news';
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation
    if (!prompt.trim()) {
      setError('Please enter a prompt for your podcast');
      return;
    }
    
    if (prompt.length > 1000) {
      setError('Prompt must be 1000 characters or less');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Create description from the first 100 characters of the prompt
      const description = prompt.slice(0, 100) + (prompt.length > 100 ? '...' : '');
      
      // Call API to create podcast - title will be generated on the backend
      const newPodcast = await createPodcast({
        description,
        prompt, // Store the full prompt for future episode generation
        podcastType // Always 'news'
      });
      
      console.log('Created podcast:', newPodcast);
      
      // Redirect to the new podcast page
      navigate(`/podcasts/${newPodcast.id}`);
    } catch (err) {
      console.error('Error creating podcast:', err);
      setError('Failed to create podcast. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', px: 2 }}>
      <MuiLink
        component={Link}
        to="/"
        sx={{ 
          display: 'inline-block',
          mb: 3,
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' }
        }}
      >
        ← Back to Podcasts
      </MuiLink>
      
      <Card elevation={1}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Create New Podcast
          </Typography>
          
          {error && (
            <Alert 
              severity="error" 
              onClose={() => setError(null)}
              sx={{ mb: 3 }}
            >
              {error}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Podcast Prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your podcast concept in detail (up to 1000 characters)"
              disabled={isSubmitting}
              error={prompt.length > 1000}
              helperText={`${prompt.length}/1000 characters`}
              sx={{ mb: 2 }}
            />
            
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ mb: 3 }}
            >
              This prompt will be used to generate news podcast episodes based on current web information. 
              Be specific about the topics, style, and focus you'd like for your news podcast.
            </Typography>
            
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ minWidth: 200 }}
            >
              {isSubmitting ? (
                <>
                  Creating podcast...
                  <CircularProgress
                    size={24}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      marginTop: '-12px',
                      marginLeft: '-12px',
                    }}
                  />
                </>
              ) : (
                'Create Podcast'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreatePodcastForm; 