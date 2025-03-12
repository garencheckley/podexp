import React, { useState } from 'react';
import { createPodcast } from '../services/api';
import { useNavigate } from 'react-router-dom';

const CreatePodcastForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation
    if (!title.trim()) {
      setError('Please enter a podcast title');
      return;
    }
    
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
      
      // Call API to create podcast
      const newPodcast = await createPodcast({
        title,
        description,
        prompt // Store the full prompt for future episode generation
      });
      
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
    <div className="create-podcast-form">
      <h2>Create New Podcast</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="podcast-title">Podcast Title</label>
          <input
            id="podcast-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter podcast title"
            maxLength={100}
            disabled={isSubmitting}
          />
        </div>
        
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
            This prompt will be used to generate episodes. Be descriptive about the characters, setting, and style.
          </p>
        </div>
        
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="submit-button"
        >
          {isSubmitting ? 'Creating...' : 'Create Podcast'}
        </button>
      </form>
    </div>
  );
};

export default CreatePodcastForm; 