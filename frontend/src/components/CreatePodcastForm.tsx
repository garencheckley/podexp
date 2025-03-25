import React, { useState } from 'react';
import { createPodcast } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';

const CreatePodcastForm: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(false);
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
        useWebSearch // Add the useWebSearch flag
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
              This prompt will be used to generate episodes and an automatic title for your podcast. Be descriptive about the characters, setting, and style.
              <br /><br />
              <strong>Tip:</strong> You can specify episode length by including phrases like "episode length: 2 minutes" or "episode duration: 300 words" in your prompt. If not specified, episodes will default to 2 minutes in length.
            </p>
          </div>
          
          <div className="form-group">
            <div className="web-search-toggle">
              <input
                type="checkbox"
                id="use-web-search"
                checked={useWebSearch}
                onChange={(e) => setUseWebSearch(e.target.checked)}
                disabled={isSubmitting}
              />
              <label htmlFor="use-web-search">
                Use real-time web information
              </label>
            </div>
            <p className="form-help web-search-help">
              When enabled, the podcast will use current information from the web to generate up-to-date content.
              <br />
              Recommended for news, current events, and other topics that benefit from the latest information.
              <br />
              Not recommended for fictional stories or historical content.
            </p>
          </div>
          
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