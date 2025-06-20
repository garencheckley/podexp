export interface Podcast {
  id?: string;
  userId?: string;
  ownerEmail?: string;
  visibility?: 'public' | 'private';
  title: string;
  description: string;
  prompt?: string;
  podcastType?: string;
  created_at?: string;
  last_updated?: string;
  episodes: Episode[];
  sources?: PodcastSource[];
  autoGenerate?: boolean;
}

export interface PodcastSource {
  url: string;
  name: string;
  category: string;
  topicRelevance: string[];
  qualityScore: number;
  lastUsed?: string;
}

export interface Episode {
  id?: string;
  podcastId: string;
  title: string;
  description: string;
  content: string;
  audioUrl?: string;
  sources?: string[];
  created_at?: string;
}

export interface AudioPlayerProps {
  audioUrl: string;
  title: string;
}

// Remove mock data as we'll be fetching from the backend 