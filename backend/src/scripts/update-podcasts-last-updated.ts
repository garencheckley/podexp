// Set environment to production
process.env.NODE_ENV = 'production';

import { initializeFirebase } from '../services/database';

/**
 * Migration script to add last_updated field to existing podcasts
 * This script sets the last_updated field to the created_at date or current date if created_at is missing
 */
async function updatePodcastsLastUpdated() {
  console.log('Initializing Firebase...');
  
  try {
    initializeFirebase();
    console.log('Firebase Admin SDK initialized');
    
    // Get Firestore instance
    console.log('Creating Firestore instance...');
    const admin = require('firebase-admin');
    const db = admin.firestore();
    console.log('Firestore instance created');
    
    // Get all podcasts
    console.log('Fetching all podcasts...');
    const podcastsSnapshot = await db.collection('podcasts').get();
    
    // Update each podcast with a last_updated field
    const batch = db.batch();
    let updateCount = 0;
    
    console.log(`Found ${podcastsSnapshot.size} podcasts to update`);
    
    for (const podcastDoc of podcastsSnapshot.docs) {
      const podcastData = podcastDoc.data();
      
      // Use created_at as last_updated if available, or current timestamp
      const lastUpdated = podcastData.created_at || new Date().toISOString();
      
      console.log(`Updating podcast ${podcastData.title} with last_updated=${lastUpdated}`);
      
      // Get the most recent episode (if any) to potentially use its timestamp
      const episodesSnapshot = await db.collection('podcasts')
        .doc(podcastDoc.id)
        .collection('episodes')
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();
      
      // If there's a more recent episode, use its timestamp instead
      if (!episodesSnapshot.empty) {
        const latestEpisode = episodesSnapshot.docs[0].data();
        if (latestEpisode.created_at && latestEpisode.created_at > lastUpdated) {
          console.log(`Using more recent timestamp from episode: ${latestEpisode.created_at}`);
          batch.update(podcastDoc.ref, { last_updated: latestEpisode.created_at });
        } else {
          batch.update(podcastDoc.ref, { last_updated: lastUpdated });
        }
      } else {
        batch.update(podcastDoc.ref, { last_updated: lastUpdated });
      }
      
      updateCount++;
    }
    
    // Commit the batch update
    if (updateCount > 0) {
      console.log(`Committing batch update for ${updateCount} podcasts...`);
      await batch.commit();
      console.log('Batch update completed successfully');
    } else {
      console.log('No podcasts to update');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error updating podcasts:', error);
  }
  
  console.log('Migration completed');
}

// Run the function
updatePodcastsLastUpdated(); 