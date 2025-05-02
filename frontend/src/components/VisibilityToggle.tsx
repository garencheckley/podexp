import React, { useState } from 'react';
import { updatePodcastVisibility } from '../services/api';
import '../styles/VisibilityToggle.css';

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

  // Only show the toggle if the user is the owner
  if (!isOwner) {
    return (
      <div className="visibility-status">
        {visibility === 'public' ? (
          <span className="public-badge">Public</span>
        ) : (
          <span className="private-badge">Private</span>
        )}
      </div>
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
    <div className="visibility-toggle-container">
      <div className="visibility-label">
        Visibility: 
        <span className={visibility === 'public' ? 'public-text' : 'private-text'}>
          {visibility === 'public' ? ' Public' : ' Private'}
        </span>
      </div>
      
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={visibility === 'public'}
          onChange={handleToggle}
          disabled={isUpdating}
        />
        <span className="toggle-slider"></span>
      </label>
      
      {error && <div className="visibility-error">{error}</div>}
    </div>
  );
};

export default VisibilityToggle; 