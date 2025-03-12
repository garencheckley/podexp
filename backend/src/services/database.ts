import * as admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';

let db: Firestore | null = null;

export interface Podcast {
  id: string;
  title: string;
  description: string;
  prompt?: string;
  episodes: Episode[];
}

export interface Episode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  content: string;
  summary?: string;
  audioUrl?: string;
  created_at: string;
}

export function initializeFirebase() {
  if (admin.apps.length === 0) {
    console.log('Initializing Firebase Admin SDK...');
    
    if (process.env.NODE_ENV === 'production') {
      // In production, use the default credentials
      admin.initializeApp({
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
      });
    } else {
      // In development, use the service account key
      admin.initializeApp({
        credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || ''),
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
      });
    }
    
    console.log('Firebase Admin SDK initialized');
  }
}

export function getDb(): Firestore {
  if (!db) {
    console.log('Creating Firestore instance...');
    db = admin.firestore();
    console.log('Firestore instance created');
  }
  return db;
}

export async function getAllPodcasts(): Promise<Podcast[]> {
  console.log('Fetching all podcasts...');
  const snapshot = await getDb().collection('podcasts').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Podcast));
}

export async function getPodcast(id: string): Promise<Podcast | null> {
  console.log(`Fetching podcast with ID: ${id}`);
  const doc = await getDb().collection('podcasts').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Podcast;
}

export async function createPodcast(podcast: Omit<Podcast, 'id'>): Promise<Podcast> {
  console.log('Creating new podcast:', podcast);
  const docRef = await getDb().collection('podcasts').add(podcast);
  return { id: docRef.id, ...podcast };
}

export async function getEpisodesByPodcastId(podcastId: string): Promise<Episode[]> {
  console.log(`Fetching episodes for podcast ID: ${podcastId}`);
  const snapshot = await getDb()
    .collection('episodes')
    .where('podcastId', '==', podcastId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Episode));
}

export async function createEpisode(episode: Omit<Episode, 'id'>): Promise<Episode> {
  console.log('Creating new episode:', episode);
  const episodeWithTimestamp = {
    ...episode,
    created_at: new Date().toISOString()
  };
  const docRef = await getDb().collection('episodes').add(episodeWithTimestamp);
  return { id: docRef.id, ...episodeWithTimestamp };
}

export async function updateEpisodeSummary(episodeId: string, summary: string): Promise<void> {
  console.log(`Updating summary for episode ID: ${episodeId}`);
  await getDb().collection('episodes').doc(episodeId).update({ summary });
}

export async function deleteEpisode(episodeId: string): Promise<void> {
  console.log(`Deleting episode with ID: ${episodeId}`);
  await getDb().collection('episodes').doc(episodeId).delete();
}

export async function deletePodcast(podcastId: string): Promise<void> {
  console.log(`Deleting podcast with ID: ${podcastId}`);
  
  // First, get all episodes for this podcast
  const episodes = await getEpisodesByPodcastId(podcastId);
  
  // Delete each episode
  const episodeDeletions = episodes.map(episode => deleteEpisode(episode.id));
  await Promise.all(episodeDeletions);
  
  // Finally, delete the podcast
  await getDb().collection('podcasts').doc(podcastId).delete();
}

export async function getEpisode(episodeId: string): Promise<Episode | null> {
  console.log(`Fetching episode with ID: ${episodeId}`);
  const doc = await getDb().collection('episodes').doc(episodeId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Episode;
} 