import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Switch, 
  FormControlLabel, 
  Alert,
  Chip
} from '@mui/material';
import {
  Public as PublicIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { updatePodcastVisibility } from '../services/api';

interface VisibilityToggleProps {
  podcastId: string;
  initialVisibility: 'public' | 'private';
  isOwner: boolean;
  onUpdate?: (newVisibility: 'public' | 'private') => void;
}

const VisibilityToggle: React.FC<VisibilityToggleProps> = ({ 
  podcastId, 
  initialVisibility = 'private', 
  isOwner,
  onUpdate 
}) => {
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialVisibility);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show the status if the user is not the owner
  if (!isOwner) {
    return (
      <Chip
        icon={visibility === 'public' ? <PublicIcon /> : <LockIcon />}
        label={visibility === 'public' ? 'Public' : 'Private'}
        color={visibility === 'public' ? 'success' : 'default'}
        variant="outlined"
      />
    );
  }

  const handleToggle = async () => {
    const newVisibility = visibility === 'public' ? 'private' : 'public';
    setIsUpdating(true);
    setError(null);
    
    try {
      await updatePodcastVisibility(podcastId, newVisibility);
      setVisibility(newVisibility);
      if (onUpdate) {
        onUpdate(newVisibility);
      }
    } catch (error) {
      console.error('Failed to update visibility:', error);
      setError('Failed to update visibility. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={visibility === 'public'}
            onChange={handleToggle}
            disabled={isUpdating}
            color="success"
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {visibility === 'public' ? (
              <>
                <PublicIcon color="success" />
                <Typography>Public</Typography>
              </>
            ) : (
              <>
                <LockIcon />
                <Typography>Private</Typography>
              </>
            )}
          </Box>
        }
      />
      
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mt: 1 }}
        >
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default VisibilityToggle; 