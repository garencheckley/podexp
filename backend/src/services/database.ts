import * as admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';

let db: Firestore | null = null;

export interface Podcast {
  id?: string;
  userId?: string;
  ownerEmail?: string;          // Email of the podcast owner
  visibility?: "public" | "private"; // Visibility setting, defaults to "private"
  title: string;
  description: string;
  prompt?: string;
  podcastType?: string;
  created_at?: string;
  last_updated?: string;
  episodes: Episode[];
  sources?: PodcastSource[];
}

export interface PodcastSource {
  url: string;
  name: string;
  category: string;
  topicRelevance: string[];
  qualityScore: number;
  frequency?: string;
  perspective?: string;
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
  bulletPoints?: string[];
  narrativeStructure?: {
    introduction: {
      wordCount: number;
      approach: string;
    };
    bodySections: Array<{
      sectionTitle: string;
      wordCount: number;
    }>;
    conclusion: {
      wordCount: number;
    };
    adherenceMetrics?: {
      structureScore: number;
      balanceScore: number;
      transitionScore: number;
      overallAdherence: number;
    };
  };
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

export async function getAllPodcasts(userId?: string): Promise<Podcast[]> {
  console.log('Getting podcasts with simplified auth check logic');
  
  if (!userId) {
    console.warn('No userId provided. Only fetching public podcasts.');
    // Fetch only public podcasts if no user is logged in
    const publicQuery = getDb().collection('podcasts')
      .where('visibility', '==', 'public')
      .orderBy('last_updated', 'desc');
    const publicSnapshot = await publicQuery.get();
    return publicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Podcast));
  }
  
  console.log(`Fetching podcasts for user email: ${userId}`);
  let allVisiblePodcasts: Podcast[] = [];
  const podcastMap = new Map<string, Podcast>();

  try {
    // 1. Get podcasts owned by this user
    console.log(`Querying podcasts owned by ${userId}`);
    const userPodcastsQuery = getDb().collection('podcasts')
      .where('ownerEmail', '==', userId)
      .orderBy('last_updated', 'desc');
    const userPodcastsSnapshot = await userPodcastsQuery.get();
    userPodcastsSnapshot.forEach(doc => {
      const podcast = { id: doc.id, ...doc.data() } as Podcast;
      if (!podcastMap.has(doc.id)) {
        podcastMap.set(doc.id, podcast);
      }
    });
    console.log(`Found ${userPodcastsSnapshot.size} podcasts owned by user.`);

    // 2. Get all public podcasts (regardless of owner)
    console.log('Querying all public podcasts');
    const publicPodcastsQuery = getDb().collection('podcasts')
      .where('visibility', '==', 'public')
      .orderBy('last_updated', 'desc'); // Simpler query, might fetch duplicates of owned ones
    const publicPodcastsSnapshot = await publicPodcastsQuery.get();
    publicPodcastsSnapshot.forEach(doc => {
      const podcast = { id: doc.id, ...doc.data() } as Podcast;
      // Add to map only if not already present (handles de-duplication)
      if (!podcastMap.has(doc.id)) {
        podcastMap.set(doc.id, podcast);
      }
    });
    console.log(`Found ${publicPodcastsSnapshot.size} public podcasts in total.`);

    // Convert map values back to an array
    allVisiblePodcasts = Array.from(podcastMap.values());

    // Optional: Sort the final combined list by last_updated again, as combining might change order
    allVisiblePodcasts.sort((a, b) => {
      const dateA = a.last_updated ? new Date(a.last_updated).getTime() : 0;
      const dateB = b.last_updated ? new Date(b.last_updated).getTime() : 0;
      return dateB - dateA; // Descending order
    });

  } catch (error) {
    console.error('Error fetching podcasts with simplified logic:', error);
    // Re-throw the error to be caught by the route handler
    throw error; 
  }

  console.log(`Returning ${allVisiblePodcasts.length} unique podcasts visible to user ${userId}`);
  return allVisiblePodcasts;
}

export async function getPodcast(id: string, userEmail?: string): Promise<Podcast | null> {
  console.log(`Fetching podcast with ID: ${id} for user: ${userEmail || 'anonymous'}`);
  const doc = await getDb().collection('podcasts').doc(id).get();
  
  if (!doc.exists) return null;
  
  const podcast = { id: doc.id, ...doc.data() } as Podcast;
  
  // If user is not logged in, only return public podcasts
  if (!userEmail && podcast.visibility !== 'public') {
    console.log('Access denied: User not authenticated and podcast is private');
    return null;
  }
  
  // If user is logged in, return the podcast if they own it or it's public
  if (userEmail && podcast.ownerEmail !== userEmail && podcast.visibility !== 'public') {
    console.log('Access denied: User does not own this private podcast');
    return null;
  }
  
  return podcast;
}

export async function createPodcast(podcast: Omit<Podcast, 'id'>): Promise<Podcast> {
  console.log('Creating new podcast:', podcast);
  const now = new Date().toISOString();
  
  // Ensure podcast has ownerEmail (from userId) and default visibility to private
  const podcastWithDefaults = {
    ...podcast,
    ownerEmail: podcast.ownerEmail || podcast.userId,
    visibility: podcast.visibility || 'private',
    created_at: now,
    last_updated: now,
    podcastType: podcast.podcastType || 'news'
  };
  
  const docRef = await getDb().collection('podcasts').add(podcastWithDefaults);
  return { id: docRef.id, ...podcastWithDefaults };
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

/**
 * Updates the audio URL for an episode
 * @param episodeId The ID of the episode to update
 * @param audioUrl The URL of the generated audio
 */
export async function updateEpisodeAudio(episodeId: string | undefined, audioUrl: string): Promise<void> {
  if (!episodeId) {
    console.error('Unable to update episode audio: Episode ID is undefined');
    return;
  }
  
  console.log(`Updating episode ${episodeId} with audio URL: ${audioUrl}`);
  await getDb().collection('episodes').doc(episodeId).update({ audioUrl });
}

/**
 * Updates a podcast's details
 * @param podcastId The ID of the podcast to update
 * @param details The podcast details to update
 * @returns The updated podcast
 */
export async function updatePodcast(
  podcastId: string, 
  details: Partial<Pick<Podcast, 'title' | 'description' | 'prompt' | 'podcastType' | 'last_updated' | 'sources' | 'userId' | 'ownerEmail' | 'visibility'>>
): Promise<void> {
  console.log(`Updating podcast ${podcastId}:`, details);
  await getDb().collection('podcasts').doc(podcastId).update(details);
}

/**
 * Updates an episode with narrative structure information
 * @param episodeId The ID of the episode to update
 * @param narrativeStructure The narrative structure information
 */
export async function updateEpisodeNarrativeStructure(
  episodeId: string,
  narrativeStructure: Episode['narrativeStructure']
): Promise<void> {
  if (!episodeId) {
    console.error('Unable to update episode narrative structure: Episode ID is undefined');
    return;
  }
  
  console.log(`Updating episode ${episodeId} with narrative structure information`);
  await getDb().collection('episodes').doc(episodeId).update({ narrativeStructure });
}