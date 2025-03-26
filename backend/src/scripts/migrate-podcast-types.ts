import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * This script updates existing podcasts to use the new podcastType field
 * instead of the useWebSearch boolean flag.
 * 
 * Podcasts with useWebSearch=true will be set to podcastType='news'
 * Podcasts with useWebSearch=false or undefined will be set to podcastType='fictional'
 */
async function migratePodcastTypes() {
  console.log('Starting podcast type migration...');
  
  // Initialize Firebase
  if (admin.apps.length === 0) {
    console.log('Initializing Firebase Admin SDK...');
    
    if (process.env.NODE_ENV === 'production') {
      // In production, use the default credentials
      admin.initializeApp({
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
      });
    } else {
      // In development, try to use the application default credentials
      try {
        admin.initializeApp({
          projectId: process.env.GOOGLE_CLOUD_PROJECT || 'gcpg-452703',
        });
      } catch (error) {
        console.error('Failed to initialize Firebase with application default credentials:', error);
        process.exit(1);
      }
    }
    
    console.log('Firebase Admin SDK initialized');
  }
  
  const db = admin.firestore();
  
  try {
    // Get all podcasts
    const snapshot = await db.collection('podcasts').get();
    console.log(`Found ${snapshot.size} podcasts to migrate`);
    
    // Prepare batch updates
    const batchSize = 500; // Firestore limit is 500 operations per batch
    let batch = db.batch();
    let operationCount = 0;
    let updatedCount = 0;
    
    // Process each podcast
    for (const doc of snapshot.docs) {
      const podcast = doc.data();
      const docRef = db.collection('podcasts').doc(doc.id);
      
      // Determine the new podcast type
      const podcastType = podcast.useWebSearch === true ? 'news' : 'fictional';
      console.log(`Podcast ${doc.id}: ${podcast.title} -> ${podcastType}`);
      
      // Create an update object that removes useWebSearch and adds podcastType
      const updates: any = {
        podcastType: podcastType
      };
      
      // Use FieldValue.delete() to remove the useWebSearch field
      updates.useWebSearch = admin.firestore.FieldValue.delete();
      
      // Add the update to the batch
      batch.update(docRef, updates);
      operationCount++;
      updatedCount++;
      
      // If we reach the batch limit, commit and start a new batch
      if (operationCount >= batchSize) {
        console.log(`Committing batch of ${operationCount} updates...`);
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
      }
    }
    
    // Commit any remaining updates
    if (operationCount > 0) {
      console.log(`Committing final batch of ${operationCount} updates...`);
      await batch.commit();
    }
    
    console.log(`Migration completed successfully. Updated ${updatedCount} podcasts.`);
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
migratePodcastTypes().then(() => {
  console.log('Migration script completed');
  process.exit(0);
}).catch(error => {
  console.error('Migration script failed:', error);
  process.exit(1);
}); 