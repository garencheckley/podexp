import { Podcast, Episode } from '../types';

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

export async function createPodcast(podcast: Pick<Podcast, 'title' | 'description' | 'prompt'>): Promise<Podcast> {
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

export async function generateEpisode(podcastId: string): Promise<Episode> {
  const response = await fetch(`${API_URL}/podcasts/${podcastId}/generate-episode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to generate episode');
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