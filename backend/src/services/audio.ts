import * as textToSpeech from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import * as util from 'util';
import * as path from 'path';

// Initialize clients
const ttsClient = new textToSpeech.TextToSpeechClient();
const storage = new Storage();

// Define the bucket name for audio storage
// Use a default project ID if the environment variable is not set
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'gcpg-452703';
const bucketName = `${projectId}-podcast-audio`;

// Ensure the bucket exists
async function ensureBucketExists(): Promise<void> {
  try {
    const [buckets] = await storage.getBuckets();
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Creating bucket: ${bucketName}`);
      await storage.createBucket(bucketName, {
        location: 'us-west1',
        storageClass: 'STANDARD',
      });
      
      // Make bucket public
      await storage.bucket(bucketName).makePublic();
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    throw error;
  }
}

// Generate audio for text and store it in GCS
export async function generateAndStoreAudio(
  text: string,
  podcastId: string,
  episodeId: string
): Promise<string> {
  try {
    // Ensure bucket exists
    await ensureBucketExists();
    
    // Configure the request with Chirp HD voice
    const request = {
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Chirp3-HD-Leda', // Using the newest Chirp3 HD Leda voice for even more natural sound
      },
      audioConfig: { 
        audioEncoding: 'MP3' as const,
        speakingRate: 1.0,  // Normal speed
        pitch: 0.0,         // Default pitch
        effectsProfileId: ['headphone-class-device'], // Optimize for headphones
      },
    };

    // Generate audio
    console.log(`Generating audio for episode ${episodeId}`);
    const [response] = await ttsClient.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content returned from Text-to-Speech API');
    }

    // Define the file path in the bucket
    const filePath = `podcasts/${podcastId}/episodes/${episodeId}.mp3`;
    const file = storage.bucket(bucketName).file(filePath);
    
    // Upload the audio content to GCS
    console.log(`Uploading audio to ${filePath}`);
    await file.save(response.audioContent as Buffer, {
      metadata: {
        contentType: 'audio/mp3',
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Get the public URL
    const audioUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
    console.log(`Audio URL: ${audioUrl}`);
    
    return audioUrl;
  } catch (error) {
    console.error('Error generating or storing audio:', error);
    throw error;
  }
}

// Delete audio file from GCS
export async function deleteAudio(podcastId: string, episodeId: string): Promise<void> {
  try {
    const filePath = `podcasts/${podcastId}/episodes/${episodeId}.mp3`;
    console.log(`Deleting audio file: ${filePath}`);
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    
    // Check if file exists before deleting
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`Successfully deleted audio file: ${filePath}`);
    } else {
      console.log(`Audio file not found: ${filePath}`);
    }
  } catch (error) {
    console.error('Error deleting audio file:', error);
    throw error;
  }
} 