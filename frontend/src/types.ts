export interface Podcast {
  id?: string;
  title: string;
  description: string;
  prompt?: string;
  created_at?: string;
}

export interface Episode {
  id?: string;
  podcastId: string;
  title: string;
  description: string;
  content: string;
  audioUrl?: string;
  created_at?: string;
}

// Remove mock data as we'll be fetching from the backend 