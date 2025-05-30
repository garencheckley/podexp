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
    headers: {
      ...options.headers,
      ...getAuthHeaders(), // Add JavaScript-based auth headers (X-User-Email)
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
    // credentials: 'include', // REMOVED - No longer needed
  });
  
  if (!response.ok) {
    throw new Error('Failed to request login link');
  }
}

// Function to handle token verification solely via JSON response
export async function verifyToken(token: string): Promise<{ success: boolean; email: string | null }> {
  try {
    const response = await fetch(`${API_URL}/auth/verify?token=${token}`, {
      headers: {
        // Ensure we request JSON
        'Accept': 'application/json',
      },
      // Do not send credentials (cookies) for this request
      // credentials: 'omit', // Optional: explicitly omit if needed
    });
    
    if (!response.ok) {
      console.error(`Token verification failed with status: ${response.status}`);
      return { success: false, email: null };
    }
    
    const data = await response.json();
    if (data.success && data.email) {
      // Return success and email, DO NOT set localStorage here
      console.log('Token verification successful, returning email:', data.email);
      return { success: true, email: data.email };
    } else {
      console.error('Token verification response did not contain success/email');
      return { success: false, email: null };
    }
  } catch (error) {
    console.error('Token verification network/parse error:', error);
    return { success: false, email: null };
  }
}

// Updated logout function - client-side only
export function logout(): void { // No longer async, returns void
  console.log('Performing client-side logout: clearing localStorage.');
  // Clear localStorage email
  localStorage.removeItem(USER_EMAIL_KEY);
  // No backend call needed
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
  const response = await fetch(`${API_URL}/podcasts`, addAuthHeaders({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(podcast),
  }));
  if (!response.ok) {
    throw new Error('Failed to create podcast');
  }
  return response.json();
}

export async function createEpisode(
  podcastId: string,
  episode: Pick<Episode, 'title' | 'description' | 'content'>
): Promise<Episode> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes`, addAuthHeaders({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(episode),
  }));
  if (!response.ok) {
    throw new Error('Failed to create episode');
  }
  return response.json();
}

/**
 * Interface for topic option
 */
export interface TopicOption {
  id: string;
  topic: string;
  description: string;
  relevance: number;
  recency: string;
  query: string;
  reasoning: string;
}

/**
 * Interface for topic options response
 */
export interface TopicOptionsResponse {
  topicOptions: TopicOption[];
  episodeAnalysis: {
    episodeCount: number;
    recentTopics: Array<{ topic: string; frequency: number }>;
  };
}

/**
 * Get topic options for episode generation
 * @param podcastId The ID of the podcast
 * @returns Topic options and episode analysis
 */
export async function getTopicOptions(podcastId: string): Promise<TopicOptionsResponse> {
  try {
    const fetchOptions = addAuthHeaders({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await fetch(`${API_URL}/podcasts/${podcastId}/get-topic-options`, fetchOptions);

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {}
      console.error(`Get topic options failed: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Failed to get topic options: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getTopicOptions function:', error);
    throw error;
  }
}

/**
 * Generate a new episode for a podcast
 * @param podcastId The ID of the podcast
 * @param options Generation options including optional selectedTopic
 * @returns The generated episode and generation log ID
 */
export async function generateEpisode(
  podcastId: string, 
  options: { 
    targetMinutes?: number; 
    targetWordCount?: number;
    selectedTopic?: TopicOption;
  } = {}
): Promise<{ episode: Episode; generationLogId: string }> {
  try {
    // Use addAuthHeaders to include potential X-User-Email header
    const fetchOptions = addAuthHeaders({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
    
    console.log('Generate episode fetch options:', fetchOptions); // Log options for debugging

    const response = await fetch(`${API_URL}/podcasts/${podcastId}/generate-episode`, fetchOptions);

    if (!response.ok) {
      // Try to get more detailed error from response body if possible
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {}
      console.error(`Generate episode failed: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Failed to generate episode: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in generateEpisode function:', error);
    throw error;
  }
}

export async function regenerateAudio(podcastId: string, episodeId: string): Promise<Episode> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes/${episodeId}/regenerate-audio`, addAuthHeaders({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }));
  
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
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes/${episodeId}`, addAuthHeaders({
    method: 'DELETE',
  }));
  if (!response.ok) {
    throw new Error('Failed to delete episode');
  }
}

export async function deletePodcast(podcastId: string): Promise<void> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, addAuthHeaders({
    method: 'DELETE',
  }));
  if (!response.ok) {
    throw new Error('Failed to delete podcast');
  }
}

export async function updatePodcast(
  podcastId: string,
  updates: Partial<Pick<Podcast, 'title' | 'description' | 'prompt' | 'podcastType'>>
): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, addAuthHeaders({
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  }));
  
  if (!response.ok) {
    throw new Error('Failed to update podcast');
  }
  
  return response.json();
}

// New function to update podcast visibility
export async function updatePodcastVisibility(
  podcastId: string,
  visibility: 'public' | 'private'
): Promise<Podcast> { // Return the updated podcast
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, addAuthHeaders({
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ visibility }),
  }));

  if (!response.ok) {
    // Handle specific errors if needed, e.g., 403 Forbidden, 404 Not Found
    const errorBody = await response.text();
    console.error(`Failed to update visibility: ${response.status}`, errorBody);
    throw new Error(`Failed to update visibility: ${response.statusText}`);
  }
  
  return response.json(); // Return the updated podcast data from the response
}

/**
 * Interface for LLM prompt log data
 */
export interface LLMPromptLog {
  id: string;
  apiType: 'gemini' | 'perplexity';
  model: string;
  promptText: string;
  responseText: string;
  tokenCount?: number;
  processingTimeMs: number;
  timestamp: string;
  stage: string;
  purpose: string;
  metadata?: Record<string, any>;
}

/**
 * Interface for episode generation log stage data
 */
export interface EpisodeGenerationStage {
  processingTimeMs: number;
  llmPrompts?: LLMPromptLog[];
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
    // Wrap fetch options with addAuthHeaders
    const response = await fetch(`${API_URL}/episode-logs/${logId}`, addAuthHeaders({
      // credentials: 'include', // REMOVED - addAuthHeaders handles auth now
    }));
    
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
    // Wrap fetch options with addAuthHeaders
    const response = await fetch(`${API_URL}/episodes/${episodeId}/generation-log`, addAuthHeaders({
      // credentials: 'include', // REMOVED - addAuthHeaders handles auth now
    }));
    
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

export function getRssFeedUrl(podcastId: string): string {
  return `${API_URL}/podcasts/${podcastId}/rss`;
} 