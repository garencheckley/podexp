import React, { useState } from 'react';
import { createPodcast } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';

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
    <div className="container">
      <Link to="/" className="back-button">
        ← Back to Podcasts
      </Link>
      
      <div className="create-podcast-form">
        <h2>Create New Podcast</h2>
        
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
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="podcast-prompt">
              Podcast Prompt <span className="character-count">{prompt.length}/1000</span>
            </label>
            <textarea
              id="podcast-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your podcast concept in detail (up to 1000 characters)"
              rows={6}
              maxLength={1000}
              disabled={isSubmitting}
            />
            <p className="form-help">
              This prompt will be used to generate news podcast episodes based on current web information. Be specific about the topics, style, and focus you'd like for your news podcast.
            </p>
          </div>
          
          {/* Podcast type selection removed, always using 'news' type */}
          
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="submit-button"
          >
            {isSubmitting ? 'Creating podcast...' : 'Create Podcast'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePodcastForm; 