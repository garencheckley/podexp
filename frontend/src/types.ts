export interface Podcast {
  id?: string;
  title: string;
  description: string;
  prompt: string;
  podcastType?: string;
  created_at?: string;
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