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

const fixPodcasts = async () => {
  try {
    // Initialize Firebase
    initializeFirebase();
    const db = admin.firestore();
    
    console.log('Starting podcast fixes...');
    
    // 1. Delete the Test Podcast
    console.log('Finding and deleting "Test Podcast"...');
    const testPodcastSnapshot = await db.collection('podcasts').where('title', '==', 'Test Podcast').get();
    const testPodcastDeletePromises = testPodcastSnapshot.docs.map(doc => {
      console.log(`Deleting Test Podcast: ${doc.id}`);
      return doc.ref.delete();
    });
    await Promise.all(testPodcastDeletePromises);
    console.log(`Deleted ${testPodcastSnapshot.size} Test Podcasts.`);
    
    // 2. Fix undefined titles
    console.log('Fixing undefined podcast titles...');
    
    // Get podcasts with undefined titles
    const undefinedTitleSnapshot = await db.collection('podcasts').get();
    let fixedCount = 0;
    
    for (const doc of undefinedTitleSnapshot.docs) {
      const podcast = doc.data();
      
      if (podcast.title === undefined || podcast.title === 'undefined') {
        let newTitle = '';
        
        // Extract title from description
        if (podcast.description.includes('Timmy the T-Rex')) {
          newTitle = 'Timmy the T-Rex and his adventures';
        } else if (podcast.description.includes('Detective Dog')) {
          newTitle = 'Detective Dog Mysteries';
        } else {
          // Generate a generic title if we can't determine it
          newTitle = 'Untitled Podcast';
        }
        
        console.log(`Fixing podcast ${doc.id}: Setting title to "${newTitle}"`);
        await doc.ref.update({ title: newTitle });
        fixedCount++;
      }
    }
    
    console.log(`Fixed ${fixedCount} podcasts with undefined titles.`);
    console.log('Podcast fixes completed successfully.');
  } catch (error) {
    console.error('Error fixing podcasts:', error);
  } finally {
    process.exit(0);
  }
};

// Run the script
fixPodcasts(); 