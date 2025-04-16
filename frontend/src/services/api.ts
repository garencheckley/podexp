import { Podcast, Episode } from '../types';

// Use local backend for development
// const API_URL = 'http://localhost:8080/api';
// Use production backend for deployment
const API_URL = 'https://podcast-backend-827681017824.us-west1.run.app/api';

export async function getAllPodcasts(): Promise<Podcast[]> {
  const response = await fetch(`${API_URL}/podcasts`);
  if (!response.ok) {
    throw new Error('Failed to fetch podcasts');
  }
  return response.json();
}

export async function getPodcast(id: string): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch podcast');
  }
  return response.json();
}

export async function getEpisodes(podcastId: string): Promise<Episode[]> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/episodes`);
  if (!response.ok) {
    throw new Error('Failed to fetch episodes');
  }
  return response.json();
}

export async function createPodcast(podcast: Partial<Pick<Podcast, 'title' | 'description' | 'prompt'>> & Pick<Podcast, 'description' | 'prompt'> & { podcastType?: string }): Promise<Podcast> {
  const response = await fetch(`${API_URL}/podcasts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(podcast),
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
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(episode),
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
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
      'Content-Type': 'application/json',
    },
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
  });
  if (!response.ok) {
    throw new Error('Failed to delete episode');
  }
}

export async function deletePodcast(podcastId: string): Promise<void> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}`, {
    method: 'DELETE',
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
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update podcast');
  }
  
  return response.json();
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
    const response = await fetch(`${API_URL}/episode-logs/${logId}`);
    
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
    const response = await fetch(`${API_URL}/episodes/${episodeId}/generation-log`);
    
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