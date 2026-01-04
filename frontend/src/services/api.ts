import { Podcast, Episode } from '../types';
import { auth } from '../firebase';
import { getIdToken } from 'firebase/auth';

// Use local backend for development
// const API_URL = 'http://localhost:8080/api';
// Use production backend for deployment
const API_URL = 'https://podcast-backend-827681017824.us-west1.run.app/api';

// Helper to get Firebase auth token
const getAuthToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await getIdToken(user);
  } catch (error) {
    console.error('Error getting Firebase token:', error);
    return null;
  }
};

// Helper to add auth headers to fetch options
const addAuthHeaders = async (options: RequestInit = {}): Promise<RequestInit> => {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return {
    ...options,
    headers,
  };
};

export async function getAllPodcasts(): Promise<Podcast[]> {
  const response = await fetch(`${API_URL}/podcasts`, await addAuthHeaders());

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to fetch podcasts');
  }

  return response.json();
}

export async function getPodcast(id: string): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts/${id}`, await addAuthHeaders());
  if (!response.ok) {
    if (response.status === 404) throw new Error('Podcast not found');
    throw new Error('Failed to fetch podcast');
  }
  return response.json();
}

export async function getEpisodes(podcastId: string): Promise<Episode[]> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes`, await addAuthHeaders());
  if (!response.ok) {
    if (response.status === 404) throw new Error('Podcast not found');
    throw new Error('Failed to fetch episodes');
  }
  return response.json();
}

export async function createPodcast(podcast: Partial<Pick<Podcast, 'title' | 'description' | 'prompt'>> & Pick<Podcast, 'description' | 'prompt'> & { podcastType?: string }): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts`, await addAuthHeaders({
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
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes`, await addAuthHeaders({
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
    const fetchOptions = await addAuthHeaders({
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
    const fetchOptions = await addAuthHeaders({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    console.log('Generate episode fetch options:', fetchOptions);

    const response = await fetch(`${API_URL}/podcasts/${podcastId}/generate-episode`, fetchOptions);

    if (!response.ok) {
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
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes/${episodeId}/regenerate-audio`, await addAuthHeaders({
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
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes/${episodeId}`, await addAuthHeaders({
    method: 'DELETE',
  }));
  if (!response.ok) {
    throw new Error('Failed to delete episode');
  }
}

export async function deletePodcast(podcastId: string): Promise<void> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, await addAuthHeaders({
    method: 'DELETE',
  }));
  if (!response.ok) {
    throw new Error('Failed to delete podcast');
  }
}

export async function updatePodcast(
  podcastId: string,
  updates: Partial<Pick<Podcast, 'title' | 'description' | 'prompt' | 'podcastType' | 'autoGenerate'>>
): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, await addAuthHeaders({
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

export async function updatePodcastVisibility(
  podcastId: string,
  visibility: 'public' | 'private'
): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, await addAuthHeaders({
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ visibility }),
  }));

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Failed to update visibility: ${response.status}`, errorBody);
    throw new Error(`Failed to update visibility: ${response.statusText}`);
  }

  return response.json();
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
    const response = await fetch(`${API_URL}/episode-logs/${logId}`, await addAuthHeaders());

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
    const response = await fetch(`${API_URL}/episodes/${episodeId}/generation-log`, await addAuthHeaders());

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
