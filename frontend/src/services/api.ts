import { Podcast, Episode } from '../types';
// Removed Firebase imports
// import { getAuth, getIdToken } from 'firebase/auth';

// Use local backend for development
// const API_URL = 'http://localhost:8080/api';
// Use production backend for deployment
const API_URL = 'https://podcast-backend-827681017824.us-west1.run.app/api';

// Key for storing the user email in localStorage
const USER_EMAIL_KEY = 'userEmail';

// Helper to get auth headers based on JavaScript-stored email
const getAuthHeaders = (): HeadersInit => {
  const email = localStorage.getItem(USER_EMAIL_KEY);
  if (email) {
    return {
      'X-User-Email': email,
    };
  }
  return {};
};

// Helper function to add auth headers to fetch options
const addAuthHeaders = (options: RequestInit = {}): RequestInit => {
  return {
    ...options,
    credentials: 'include', // Always try cookies first
    headers: {
      ...options.headers,
      ...getAuthHeaders(), // Add JavaScript-based auth headers as fallback
    },
  };
};

export async function requestLogin(email: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/login-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
    credentials: 'include', // Include cookies with requests
  });
  
  if (!response.ok) {
    throw new Error('Failed to request login link');
  }
}

// New function to handle token verification with JS-based auth
export async function verifyToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/verify?token=${token}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    if (data.success && data.email) {
      // Store email in localStorage for JavaScript-based authentication
      localStorage.setItem(USER_EMAIL_KEY, data.email);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

export async function logout(): Promise<void> {
  // Clear localStorage email
  localStorage.removeItem(USER_EMAIL_KEY);
  
  // Also try cookie-based logout
  window.location.href = `${API_URL}/auth/logout`;
}

export async function checkAuthentication(): Promise<boolean> {
  try {
    // Try to get the user's podcasts as a way to check authentication
    const response = await fetch(`${API_URL}/podcasts`, addAuthHeaders());
    
    if (response.status === 401) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
}

export async function getAllPodcasts(): Promise<Podcast[]> {
  const response = await fetch(`${API_URL}/podcasts`, addAuthHeaders());
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to fetch podcasts');
  }
  
  return response.json();
}

export async function getPodcast(id: string): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts/${id}`, addAuthHeaders());
  if (!response.ok) {
    if (response.status === 404) throw new Error('Podcast not found');
    throw new Error('Failed to fetch podcast');
  }
  return response.json();
}

export async function getEpisodes(podcastId: string): Promise<Episode[]> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes`, addAuthHeaders());
  if (!response.ok) {
    if (response.status === 404) throw new Error('Podcast not found'); // Assuming 404 for podcast not found
    throw new Error('Failed to fetch episodes');
  }
  return response.json();
}

export async function createPodcast(podcast: Partial<Pick<Podcast, 'title' | 'description' | 'prompt'>> & Pick<Podcast, 'description' | 'prompt'> & { podcastType?: string }): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', // Restored original headers
    },
    body: JSON.stringify(podcast),
    credentials: 'include', // Include cookies with requests
  });
  if (!response.ok) {
    throw new Error('Failed to create podcast');
  }
  return response.json();
}

export async function createEpisode(
  podcastId: string,
  episode: Pick<Episode, 'title' | 'description' | 'content'>
): Promise<Episode> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', // Restored original headers
    },
    body: JSON.stringify(episode),
    credentials: 'include', // Include cookies with requests
  });
  if (!response.ok) {
    throw new Error('Failed to create episode');
  }
  return response.json();
}

/**
 * Generate a new episode for a podcast
 * @param podcastId The ID of the podcast
 * @param options Generation options
 * @returns The generated episode and generation log ID
 */
export async function generateEpisode(podcastId: string, options: { targetMinutes?: number; targetWordCount?: number } = {}): Promise<{ episode: Episode; generationLogId: string }> {
  try {
    const response = await fetch(`${API_URL}/podcasts/${podcastId}/generate-episode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Restored original headers
      },
      body: JSON.stringify(options),
      credentials: 'include', // Include cookies with requests
    });

    if (!response.ok) {
      throw new Error(`Failed to generate episode: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating episode:', error);
    throw error;
  }
}

export async function regenerateAudio(podcastId: string, episodeId: string): Promise<Episode> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes/${episodeId}/regenerate-audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', // Restored original headers
    },
    credentials: 'include', // Include cookies with requests
  });
  
  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to regenerate audio');
    } catch (parseError) {
      throw new Error(`Failed to regenerate audio: ${response.statusText}`);
    }
  }
  
  return response.json();
}

export async function deleteEpisode(podcastId: string, episodeId: string): Promise<void> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes/${episodeId}`, {
    method: 'DELETE',
    credentials: 'include', // Include cookies with requests
  });
  if (!response.ok) {
    throw new Error('Failed to delete episode');
  }
}

export async function deletePodcast(podcastId: string): Promise<void> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, {
    method: 'DELETE',
    credentials: 'include', // Include cookies with requests
  });
  if (!response.ok) {
    throw new Error('Failed to delete podcast');
  }
}

export async function updatePodcast(
  podcastId: string,
  updates: Partial<Pick<Podcast, 'title' | 'description' | 'prompt' | 'podcastType'>>
): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json', // Restored original headers
    },
    body: JSON.stringify(updates),
    credentials: 'include', // Include cookies with requests
  });
  
  if (!response.ok) {
    throw new Error('Failed to update podcast');
  }
  
  return response.json();
}

export async function updatePodcastVisibility(
  podcastId: string, 
  visibility: 'public' | 'private'
): Promise<void> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/visibility`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ visibility }),
    credentials: 'include',
  });
  
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('You do not have permission to change this podcast\'s visibility');
    }
    throw new Error('Failed to update podcast visibility');
  }
}

/**
 * Interface for episode generation log stage data
 */
export interface EpisodeGenerationStage {
  processingTimeMs: number;
  [key: string]: any;
}

/**
 * Interface for episode generation decision
 */
export interface EpisodeGenerationDecision {
  stage: string;
  decision: string;
  reasoning: string;
  alternatives: string[];
  timestamp: string;
}

/**
 * Interface for episode generation log
 */
export interface EpisodeGenerationLog {
  id: string;
  podcastId: string;
  episodeId: string | null;
  timestamp: string;
  duration: {
    totalMs: number;
    stageBreakdown: {
      episodeAnalysis: number;
      initialSearch: number;
      clustering: number;
      prioritization: number;
      deepResearch: number;
      contentGeneration: number;
      audioGeneration: number;
    }
  };
  stages: {
    episodeAnalysis: EpisodeGenerationStage | null;
    initialSearch: EpisodeGenerationStage | null;
    clustering: EpisodeGenerationStage | null;
    prioritization: EpisodeGenerationStage | null;
    deepResearch: EpisodeGenerationStage | null;
    contentGeneration: EpisodeGenerationStage | null;
    audioGeneration: EpisodeGenerationStage | null;
  };
  decisions: EpisodeGenerationDecision[];
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

/**
 * Get an episode generation log by ID
 * @param logId The generation log ID
 * @returns The episode generation log
 */
export async function getEpisodeGenerationLog(logId: string): Promise<EpisodeGenerationLog> {
  try {
    console.log('Fetching generation log by ID:', logId);
    const response = await fetch(`${API_URL}/episode-logs/${logId}`, {
      credentials: 'include', // Include cookies with requests
    });
    
    console.log('Generation log response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch episode generation log: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Received generation log data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching episode generation log:', error);
    throw error;
  }
}

/**
 * Get episode generation log for a specific episode
 * @param episodeId The episode ID
 * @returns The episode generation log
 */
export async function getEpisodeGenerationLogByEpisode(episodeId: string): Promise<EpisodeGenerationLog> {
  try {
    console.log('Fetching generation log for episode ID:', episodeId);
    const response = await fetch(`${API_URL}/episodes/${episodeId}/generation-log`, {
      credentials: 'include', // Include cookies with requests
    });
    
    console.log('Generation log by episode response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch episode generation log: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Received generation log data for episode:', data);
    return data;
  } catch (error) {
    console.error('Error fetching episode generation log for episode:', error);
    throw error;
  }
} 