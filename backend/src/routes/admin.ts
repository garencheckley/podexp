import express from 'express';
import { Request, Response } from 'express';
import { initializeFirebase } from '../services/database';

const router = express.Router();

// Endpoint to update all podcasts with last_updated field
router.post('/update-podcasts-last-updated', async (req: Request, res: Response) => {
  console.log('Starting migration to update podcasts with last_updated field...');
  
  try {
    // Get Firestore instance
    const admin = require('firebase-admin');
    const db = admin.firestore();
    
    // Get all podcasts
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
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updateCount} podcasts with last_updated field`,
    });
  } catch (error) {
    console.error('Error updating podcasts:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating podcasts',
      error: error.message,
    });
  }
});

export default router; 