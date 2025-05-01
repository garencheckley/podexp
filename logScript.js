// Script to check episode generation logs for issues
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
try {
  // Try to initialize using the application default credentials
  admin.initializeApp({
    projectId: 'gcpg-452703' // Project ID from the backend/src/config/firestore.ts file
  });
  
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

async function checkGenerationLogs() {
  const db = admin.firestore();
  
  try {
    // Get the last 20 episode generation logs, ordered by timestamp
    const snapshot = await db.collection('episodeGenerationLogs')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();
    
    if (snapshot.empty) {
      console.log('No episode generation logs found');
      return;
    }
    
    console.log(`Found ${snapshot.size} episode generation logs`);
    console.log('-------------------------------------------------');
    
    const logsWithZeroEpisodes = [];
    
    // Process each log
    snapshot.forEach(doc => {
      const log = doc.data();
      const episodeAnalysis = log.stages.episodeAnalysis;
      
      if (episodeAnalysis && episodeAnalysis.episodeCount === 0) {
        // This log has "Analyzed 0 episodes"
        logsWithZeroEpisodes.push({
          id: log.id,
          podcastId: log.podcastId,
          timestamp: log.timestamp,
          episodeId: log.episodeId
        });
        
        console.log(`Log ID: ${log.id}`);
        console.log(`Podcast ID: ${log.podcastId}`);
        console.log(`Timestamp: ${log.timestamp}`);
        console.log(`Episode Count: ${episodeAnalysis.episodeCount}`);
        
        // Check for any error decisions in this log
        const errorDecisions = log.decisions.filter(d => 
          d.decision.toLowerCase().includes('error') || 
          d.reasoning.toLowerCase().includes('error')
        );
        
        if (errorDecisions.length > 0) {
          console.log('Error decisions found:');
          errorDecisions.forEach(d => {
            console.log(`- Stage: ${d.stage}`);
            console.log(`  Decision: ${d.decision}`);
            console.log(`  Reasoning: ${d.reasoning}`);
          });
        } else {
          console.log('No error decisions found in this log');
        }
        
        console.log('-------------------------------------------------');
      }
    });
    
    // Check if the podcast actually has episodes
    console.log('\n\nNow checking if these podcasts actually have episodes...\n');
    
    for (const logInfo of logsWithZeroEpisodes) {
      // Count episodes for this podcast
      const episodeSnapshot = await db.collection('episodes')
        .where('podcastId', '==', logInfo.podcastId)
        .get();
      
      console.log(`Podcast ID: ${logInfo.podcastId}`);
      console.log(`Actual episode count: ${episodeSnapshot.size}`);
      
      if (episodeSnapshot.size > 0) {
        console.log('*** BUG CONFIRMED: This podcast has episodes but analysis reported 0 ***');
        
        // List the episodes
        console.log('Episodes:');
        episodeSnapshot.forEach((episodeDoc, i) => {
          const episode = episodeDoc.data();
          console.log(`${i+1}. ID: ${episodeDoc.id}, Title: ${episode.title}, Created: ${episode.created_at}`);
          
          // Check if the episode content is empty
          if (!episode.content) {
            console.log(`   NOTE: This episode has no content!`);
          }
        });
        
        // Add a check for the created_at field format
        console.log('\nChecking episode creation dates:');
        episodeSnapshot.forEach((episodeDoc, i) => {
          const episode = episodeDoc.data();
          console.log(`${i+1}. Created: ${episode.created_at}`);
        });
      }
      
      console.log('-------------------------------------------------');
    }
    
    // Output a summary
    console.log('\n\nSummary:');
    console.log(`Total logs checked: ${snapshot.size}`);
    console.log(`Logs with "Analyzed 0 episodes": ${logsWithZeroEpisodes.length}`);
    
  } catch (error) {
    console.error('Error querying the database:', error);
  } finally {
    // Ensure the script ends
    process.exit(0);
  }
}

// Run the check
checkGenerationLogs(); 