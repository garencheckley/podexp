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

const listPodcasts = async () => {
  try {
    // Initialize Firebase
    initializeFirebase();
    const db = admin.firestore();
    
    console.log('Listing all podcasts...');
    const podcastsSnapshot = await db.collection('podcasts').get();
    
    if (podcastsSnapshot.empty) {
      console.log('No podcasts found in the database.');
    } else {
      console.log(`Found ${podcastsSnapshot.size} podcasts:`);
      podcastsSnapshot.docs.forEach((doc, index) => {
        const podcast = doc.data();
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   Title: ${podcast.title}`);
        console.log(`   Description: ${podcast.description}`);
        console.log('-----------------------------------');
      });
    }
  } catch (error) {
    console.error('Error listing podcasts:', error);
  } finally {
    process.exit(0);
  }
};

// Run the script
listPodcasts(); 