import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase
const initializeFirebase = () => {
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
        credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account-key.json'),
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
      });
    }
    
    console.log('Firebase Admin SDK initialized');
  }
};

const cleanupDatabase = async () => {
  try {
    // Initialize Firebase
    initializeFirebase();
    const db = admin.firestore();
    
    console.log('Starting database cleanup...');
    
    // 1. Delete all episodes
    console.log('Deleting all episodes...');
    const episodesSnapshot = await db.collection('episodes').get();
    const episodeDeletePromises = episodesSnapshot.docs.map(doc => {
      console.log(`Deleting episode: ${doc.id}`);
      return doc.ref.delete();
    });
    await Promise.all(episodeDeletePromises);
    console.log(`Deleted ${episodesSnapshot.size} episodes.`);
    
    // 2. Delete "test podcast"
    console.log('Finding and deleting "test podcast"...');
    const podcastsSnapshot = await db.collection('podcasts').where('title', '==', 'test podcast').get();
    const testPodcastDeletePromises = podcastsSnapshot.docs.map(doc => {
      console.log(`Deleting test podcast: ${doc.id}`);
      return doc.ref.delete();
    });
    await Promise.all(testPodcastDeletePromises);
    console.log(`Deleted ${podcastsSnapshot.size} test podcasts.`);
    
    console.log('Database cleanup completed successfully.');
  } catch (error) {
    console.error('Error during database cleanup:', error);
  } finally {
    process.exit(0);
  }
};

// Run the cleanup
cleanupDatabase(); 