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

// Ensure the bucket exists and is public
async function ensureBucketExists(): Promise<void> {
  try {
    console.log(`Checking if bucket ${bucketName} exists...`);
    const [exists] = await storage.bucket(bucketName).exists();
    
    if (!exists) {
      console.log(`Creating bucket: ${bucketName}`);
      await storage.createBucket(bucketName, {
        location: 'us-west1',
        storageClass: 'STANDARD',
      });
      
      // Make bucket public
      console.log(`Making bucket ${bucketName} public...`);
      await storage.bucket(bucketName).makePublic();
    } else {
      // Check if the bucket is already public
      console.log(`Bucket ${bucketName} exists, checking if it's public...`);
      try {
        const [policy] = await storage.bucket(bucketName).iam.getPolicy();
        const isPublic = policy.bindings?.some(
          binding => binding.role === 'roles/storage.objectViewer' && 
                    binding.members?.includes('allUsers')
        );
        
        if (!isPublic) {
          console.log(`Making existing bucket ${bucketName} public...`);
          await storage.bucket(bucketName).makePublic();
        } else {
          console.log(`Bucket ${bucketName} is already public.`);
        }
      } catch (policyError) {
        console.error(`Error checking bucket policy: ${policyError}`);
        // Try to make it public anyway
        await storage.bucket(bucketName).makePublic();
      }
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    throw error;
  }
}

// Generate audio for text and store it in GCS
export async function generateAndStoreAudio(
  text: string | undefined,
  podcastId: string | undefined,
  episodeId: string | undefined
): Promise<string> {
  // Validate input parameters
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate audio: Text content is empty or undefined');
  }
  
  if (!podcastId) {
    throw new Error('Cannot generate audio: Podcast ID is required');
  }
  
  if (!episodeId) {
    throw new Error('Cannot generate audio: Episode ID is required');
  }
  
  // Ensure all parameters are strings
  const textContent = text.trim();
  const podcast = podcastId;
  const episode = episodeId;
  
  try {
    console.log(`Starting audio generation for podcast ${podcast}, episode ${episode}`);
    
    // Ensure bucket exists and is public
    await ensureBucketExists();
    
    // Check if the text exceeds the TTS API limit (5000 bytes)
    const textBytes = Buffer.from(textContent).length;
    console.log(`Text length for episode ${episode}: ${textBytes} bytes`);
    
    let audioContent: Buffer;
    
    if (textBytes <= 4800) {
      // If text is within limits, make a single API call
      const request = {
        input: { text: textContent },
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
      console.log(`Generating audio for episode ${episode} in a single request`);
      try {
        const [response] = await ttsClient.synthesizeSpeech(request);
        
        if (!response.audioContent) {
          throw new Error('No audio content returned from Text-to-Speech API');
        }
        
        audioContent = response.audioContent as Buffer;
        console.log(`Successfully generated audio content (${audioContent.length} bytes)`);
      } catch (ttsError) {
        console.error(`Error calling Text-to-Speech API: ${ttsError}`);
        throw new Error(`Failed to generate audio: ${ttsError.message || ttsError}`);
      }
    } else {
      // If text exceeds the limit, split it into smaller chunks
      console.log(`Text exceeds TTS API limit. Splitting into chunks for episode ${episode}`);
      
      // Split into sentences and then group them into chunks
      const sentences = textContent.match(/[^.!?]+[.!?]+/g) || [textContent];
      const chunks: string[] = [];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        // Check if adding this sentence would exceed our safe limit
        if (Buffer.from(currentChunk + sentence).length > 4500 && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      
      // Add the last chunk if it's not empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      
      console.log(`Split text into ${chunks.length} chunks`);
      
      // Process each chunk and collect the audio content
      const audioChunks: Buffer[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkBytes = Buffer.from(chunk).length;
        console.log(`Processing chunk ${i+1}/${chunks.length} (${chunkBytes} bytes)`);
        
        const request = {
          input: { text: chunk },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Chirp3-HD-Leda',
          },
          audioConfig: { 
            audioEncoding: 'MP3' as const,
            speakingRate: 1.0,
            pitch: 0.0,
            effectsProfileId: ['headphone-class-device'],
          },
        };
        
        try {
          const [response] = await ttsClient.synthesizeSpeech(request);
          
          if (!response.audioContent) {
            throw new Error(`No audio content returned for chunk ${i+1}`);
          }
          
          audioChunks.push(response.audioContent as Buffer);
          console.log(`Successfully processed chunk ${i+1}/${chunks.length}`);
        } catch (chunkError) {
          console.error(`Error processing chunk ${i+1}: ${chunkError}`);
          throw new Error(`Failed to generate audio for chunk ${i+1}: ${chunkError.message || chunkError}`);
        }
      }
      
      // Combine the audio chunks
      audioContent = Buffer.concat(audioChunks);
      console.log(`Combined ${audioChunks.length} audio chunks into ${audioContent.length} bytes`);
    }

    // Define the file path in the bucket
    const filePath = `podcasts/${podcast}/episodes/${episode}.mp3`;
    const file = storage.bucket(bucketName).file(filePath);
    
    // Upload the audio content to GCS
    console.log(`Uploading audio to ${filePath}`);
    try {
      await file.save(audioContent, {
        metadata: {
          contentType: 'audio/mp3',
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
        },
      });
      
      // Make the file publicly accessible
      await file.makePublic();
      console.log(`Successfully uploaded and made public: ${filePath}`);
      
      // Get the public URL
      const audioUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
      console.log(`Audio URL: ${audioUrl}`);
      
      return audioUrl;
    } catch (uploadError) {
      console.error(`Error uploading audio file: ${uploadError}`);
      throw new Error(`Failed to upload audio file: ${uploadError.message || uploadError}`);
    }
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