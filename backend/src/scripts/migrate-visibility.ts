import * as dotenv from 'dotenv';
import { getDb, initializeFirebase } from '../services/database';

// Load environment variables
dotenv.config();

// Default owner email for existing podcasts
const DEFAULT_OWNER_EMAIL = 'garencheckley@gmail.com'; // Set to Garen's email

async function migrateVisibilityFields() {
  try {
    console.log('Initializing Firebase...');
    initializeFirebase();
    console.log('Firebase initialized successfully');

    console.log('Starting visibility migration...');
    const db = getDb();
    const podcastsRef = db.collection('podcasts');
    const snapshot = await podcastsRef.get();

    if (snapshot.empty) {
      console.log('No podcasts found to migrate');
      return;
    }

    console.log(`Found ${snapshot.size} podcasts to process`);
    let updated = 0;
    let skipped = 0;

    // Process each podcast
    for (const doc of snapshot.docs) {
      const podcast = doc.data();
      const updates: { ownerEmail?: string; visibility?: string } = {};
      let needsUpdate = false;

      // Always update ownerEmail to the specified email
      updates.ownerEmail = DEFAULT_OWNER_EMAIL;
      needsUpdate = true;

      // Add visibility if it doesn't exist (default to private)
      if (!podcast.visibility) {
        updates.visibility = 'private';
        needsUpdate = true;
      }

      // Update the document if needed
      if (needsUpdate) {
        await podcastsRef.doc(doc.id).update(updates);
        console.log(`Updated podcast ${doc.id}: ${JSON.stringify(updates)}`);
        updated++;
      } else {
        console.log(`Skipped podcast ${doc.id}: nothing to update`);
        skipped++;
      }
    }

    console.log(`Migration complete: ${updated} podcasts updated, ${skipped} podcasts skipped`);
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Run the migration
migrateVisibilityFields().then(() => {
  console.log('Migration script completed');
  process.exit(0);
}).catch(error => {
  console.error('Migration script failed:', error);
  process.exit(1);
}); 