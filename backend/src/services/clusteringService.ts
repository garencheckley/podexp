import {
  PredictionServiceClient,
  helpers,
} from '@google-cloud/aiplatform';
import { kmeans } from 'ml-kmeans';
import * as protobuf from 'protobufjs'; // Required for helpers.fromValue type checking

// --- Configuration (Replace with your actual values) ---
const GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'YOUR_PROJECT_ID'; // Replace or set env variable
const GCLOUD_LOCATION = process.env.GCLOUD_LOCATION || 'us-central1'; // Replace or set env variable
const EMBEDDING_MODEL = 'text-embedding-004';
// --- End Configuration ---

// Initialize Vertex AI Client
const predictionServiceClient = new PredictionServiceClient({
  apiEndpoint: `${GCLOUD_LOCATION}-aiplatform.googleapis.com`,
});

export interface ArticleData {
  id: string; // Unique identifier for the article/topic
  content: string; // Text content to be embedded
}

export interface ClusterResult {
  clusters: Record<number, string[]>; // Maps cluster index to array of article IDs
  noise: string[]; // Articles identified as noise (if algorithm supports it, K-Means typically doesn't)
  embeddings?: number[][]; // Optional: return embeddings if needed later
  clusterAssignments: number[]; // Array where index corresponds to article index, value is cluster index
}


/**
 * Generates embeddings for a batch of articles using Vertex AI.
 * @param articles Array of article data objects.
 * @returns A promise that resolves to an array of embeddings.
 */
async function generateEmbeddings(
  articles: ArticleData[]
): Promise<number[][]> {
  if (!articles || articles.length === 0) {
    return [];
  }
   if (GCLOUD_PROJECT === 'YOUR_PROJECT_ID') {
    console.warn('Warning: GCLOUD_PROJECT is not set. Using placeholder.');
    // Optionally return dummy data or throw error depending on desired handling
    // For now, let's throw an error to prevent unexpected behavior
     throw new Error('GCLOUD_PROJECT environment variable or placeholder not configured.');
  }


  console.log(`Generating embeddings for ${articles.length} articles using model ${EMBEDDING_MODEL}...`);

  const endpoint = `projects/${GCLOUD_PROJECT}/locations/${GCLOUD_LOCATION}/publishers/google/models/${EMBEDDING_MODEL}`;

  // Vertex AI embedding models have limits on instances per request (e.g., 250 for text-embedding-004)
  // and total input size. We'll process in batches if necessary.
  const batchSize = 250; // Adjust based on model limits if needed
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batchArticles = articles.slice(i, i + batchSize);
    const instances = batchArticles.map((article) =>
      helpers.toValue({ content: article.content.substring(0, 10000) }) // Truncate content if necessary
    );

    const request = {
      endpoint,
      instances,
    };

    try {
      const [response] = await predictionServiceClient.predict(request);
      if (!response.predictions || response.predictions.length === 0) {
        throw new Error('Received no predictions from Vertex AI embedding model.');
      }

      const embeddings = response.predictions.map((prediction) => {
        const predictionValue = helpers.fromValue(prediction as protobuf.common.IValue);
        // Ensure predictionValue and embeddings property exist and are arrays
        if (
          predictionValue &&
          typeof predictionValue === 'object' &&
          'embeddings' in predictionValue &&
          predictionValue.embeddings &&
          typeof predictionValue.embeddings === 'object' &&
          'values' in predictionValue.embeddings &&
          Array.isArray(predictionValue.embeddings.values)
        ) {
          return predictionValue.embeddings.values as number[];
        } else {
          console.error('Unexpected prediction structure:', predictionValue);
          throw new Error('Invalid embedding structure in prediction response.');
        }
      });
      allEmbeddings.push(...embeddings);
       console.log(`Generated embeddings for batch ${i / batchSize + 1}`);
    } catch (error) {
      console.error(`Error generating embeddings for batch starting at index ${i}:`, error);
      // Decide how to handle batch errors: throw, return partial, return empty?
      // For now, re-throwing to make the failure explicit.
       throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
   console.log(`Successfully generated ${allEmbeddings.length} embeddings.`);
  return allEmbeddings;
}


/**
 * Clusters articles based on their content embeddings using K-Means.
 * @param articles Array of article data objects.
 * @param numClusters Optional fixed number of clusters. If not provided, K is estimated.
 * @returns A promise that resolves to the clustering results.
 */
export async function clusterArticles(
  articles: ArticleData[],
  numClusters?: number
): Promise<ClusterResult> {
  if (!articles || articles.length === 0) {
    return { clusters: {}, noise: [], clusterAssignments: [] };
  }

  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddings(articles);
  } catch (error) {
     console.error('Failed to generate embeddings for clustering:', error);
     // Return an empty result or rethrow, depending on desired handling
     // Returning empty to allow pipeline to potentially continue without clustering
     return { clusters: {}, noise: [], clusterAssignments: [] };
   }

  if (embeddings.length !== articles.length) {
     console.error('Mismatch between number of articles and generated embeddings after generation attempt.');
     // Returning empty as state is inconsistent
     return { clusters: {}, noise: [], clusterAssignments: [] };
   }
   
   if (embeddings.length === 0) {
       console.log('No embeddings were generated, cannot perform clustering.');
       return { clusters: {}, noise: [], clusterAssignments: [] };
   }

  // Estimate K if not provided (simple heuristic)
  let k = numClusters || Math.max(1, Math.min(articles.length, Math.ceil(Math.sqrt(articles.length / 2))));
  console.log(`Performing K-Means clustering with K=${k}`);

  if (k > embeddings.length) {
     console.warn(`K (${k}) is greater than the number of data points (${embeddings.length}). Adjusting K.`);
     k = embeddings.length;
   }

  if (k === 0 && embeddings.length > 0) {
      console.warn(`K is 0 but there are embeddings. Setting K=1.`);
      k = 1;
  }

  if (k === 0) {
       console.log('No articles or embeddings to cluster.');
       return { clusters: {}, noise: [], clusterAssignments: [] };
   }


  let result;
  try {
      result = kmeans(embeddings, k, { seed: 42 }); // Use seed for reproducibility
  } catch (kmeansError) {
      console.error('Error during K-Means clustering:', kmeansError);
       // Handle specific errors, e.g., if k is invalid for the library
       // Returning empty cluster result on error
      return { clusters: {}, noise: [], clusterAssignments: [] };
  }


  const clusters: Record<number, string[]> = {};
  for (let i = 0; i < articles.length; i++) {
    const clusterIndex = result.clusters[i];
    if (clusterIndex === undefined || clusterIndex === null) {
      console.warn(`Article at index ${i} received no cluster assignment.`);
      continue; // Skip articles that didn't get assigned a cluster
    }
    if (!clusters[clusterIndex]) {
      clusters[clusterIndex] = [];
    }
    clusters[clusterIndex].push(articles[i].id);
  }

  console.log(`Clustering complete. Found ${Object.keys(clusters).length} valid clusters.`);

  return {
    clusters,
    noise: [], // K-Means doesn't inherently produce noise points like HDBSCAN
    embeddings, // Optionally return embeddings
    clusterAssignments: result.clusters,
  };
} 