import { v4 as uuidv4 } from 'uuid';
import { getDb } from './database';

export interface EpisodeAnalysisLog {
  recentTopics: Array<{ topic: string; frequency: number }>;
  coveredSources: string[];
  recurrentThemes: string[];
  episodeCount: number;
  processingTimeMs: number;
};

export interface InitialSearchLog {
  searchQueries: string[];
  potentialTopics: Array<{ 
    topic: string; 
    relevance: number; 
    query: string;
  }>;
  relevantSources: string[];
  processingTimeMs: number;
  geminiPrompt?: string;
};

export interface ClusteringLog {
  inputTopics: string[];
  clusters: Record<number, string[]>;
  clusterSummaries: Array<{
    clusterId: number;
    summary: string;
    originalTopicIds: string[];
  }>;
  processingTimeMs: number;
};

export interface PrioritizationLog {
  prioritizedTopics: Array<{
    topic: string;
    importance: number;
    newsworthiness: number;
    depthPotential: number;
    rationale: string;
    keyQuestions: string[];
  }>;
  discardedTopics: string[];
  selectionReasoning: string;
  processingTimeMs: number;
};

export interface DeepResearchLog {
  researchedTopics: Array<{
    topic: string;
    researchQueries: string[];
    sourcesConsulted: string[];
    keyInsights: string[];
    layerCount: number;
  }>;
  processingTimeMs: number;
};

export interface ContentGenerationLog {
  generatedTitle: string;
  generatedDescription: string;
  topicDistribution: Array<{
    topic: string;
    allocation: number;
  }>;
  estimatedWordCount: number;
  estimatedDuration: number;
  processingTimeMs: number;
};

export interface AudioGenerationLog {
  audioFileSize: number;
  audioDuration: number;
  processingTimeMs: number;
};

/**
 * Main episode generation log structure
 */
export interface EpisodeGenerationLog {
  id: string;
  podcastId: string;
  episodeId: string | null;
  timestamp: string;
  duration: {
    totalMs: number;
    stageBreakdown: {
      episodeAnalysis: number;
      initialSearch: number;
      clustering: number;
      prioritization: number;
      deepResearch: number;
      contentGeneration: number;
      audioGeneration: number;
    }
  };
  stages: {
    episodeAnalysis: EpisodeAnalysisLog | null;
    initialSearch: InitialSearchLog | null;
    clustering: ClusteringLog | null;
    prioritization: PrioritizationLog | null;
    deepResearch: DeepResearchLog | null;
    contentGeneration: ContentGenerationLog | null;
    audioGeneration: AudioGenerationLog | null;
  };
  decisions: Array<{
    stage: string;
    decision: string;
    reasoning: string;
    alternatives: string[];
    timestamp: string;
  }>;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export function createEpisodeGenerationLog(podcastId: string): EpisodeGenerationLog {
  return {
    id: uuidv4(),
    podcastId,
    episodeId: null,
    timestamp: new Date().toISOString(),
    duration: {
      totalMs: 0,
      stageBreakdown: {
        episodeAnalysis: 0,
        initialSearch: 0,
        clustering: 0,
        prioritization: 0,
        deepResearch: 0,
        contentGeneration: 0,
        audioGeneration: 0
      }
    },
    stages: {
      episodeAnalysis: null,
      initialSearch: null,
      clustering: null,
      prioritization: null,
      deepResearch: null,
      contentGeneration: null,
      audioGeneration: null
    },
    decisions: [],
    status: 'in_progress'
  };
}

export function addDecision(
  log: EpisodeGenerationLog,
  stage: string,
  decision: string,
  reasoning: string,
  alternatives: string[] = []
): EpisodeGenerationLog {
  const updatedLog = { ...log };
  updatedLog.decisions.push({
    stage,
    decision,
    reasoning,
    alternatives,
    timestamp: new Date().toISOString()
  });
  return updatedLog;
}

export function updateStage<T>(
  log: EpisodeGenerationLog,
  stage: keyof EpisodeGenerationLog['stages'],
  data: T,
  processingTimeMs: number
): EpisodeGenerationLog {
  const updatedLog = { ...log };
  updatedLog.stages[stage] = data as any;
  updatedLog.duration.stageBreakdown[stage as keyof EpisodeGenerationLog['duration']['stageBreakdown']] = processingTimeMs;
  updatedLog.duration.totalMs = Object.values(updatedLog.duration.stageBreakdown).reduce((a, b) => a + b, 0);
  return updatedLog;
}

export function setEpisodeId(log: EpisodeGenerationLog, episodeId: string): EpisodeGenerationLog {
  return { ...log, episodeId };
}

export function completeLog(log: EpisodeGenerationLog): EpisodeGenerationLog {
  return { ...log, status: 'completed' };
}

export function failLog(log: EpisodeGenerationLog, error: string): EpisodeGenerationLog {
  return { ...log, status: 'failed', error };
}

// Utility to recursively remove undefined values from an object
function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj && typeof obj === 'object') {
    return Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .reduce((acc, [k, v]) => {
        acc[k] = removeUndefined(v);
        return acc;
      }, {} as any);
  }
  return obj;
}

export async function saveEpisodeGenerationLog(log: EpisodeGenerationLog): Promise<void> {
  try {
    const cleanedLog = removeUndefined(log);
    console.log('Saving cleaned episode generation log (undefineds removed):', JSON.stringify(cleanedLog));
    await getDb().collection('episodeGenerationLogs').doc(log.id).set(cleanedLog);
    console.log(`Saved episode generation log: ${log.id}`);
  } catch (error) {
    console.error('Error saving episode generation log:', error);
    throw error;
  }
}

export async function getEpisodeGenerationLog(logId: string): Promise<EpisodeGenerationLog | null> {
  try {
    const doc = await getDb().collection('episodeGenerationLogs').doc(logId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as EpisodeGenerationLog;
  } catch (error) {
    console.error('Error retrieving episode generation log:', error);
    throw error;
  }
}

export async function getEpisodeGenerationLogsByPodcast(podcastId: string): Promise<EpisodeGenerationLog[]> {
  try {
    const snapshot = await getDb().collection('episodeGenerationLogs')
      .where('podcastId', '==', podcastId)
      .orderBy('timestamp', 'desc')
      .get();
    
    return snapshot.docs.map(doc => doc.data() as EpisodeGenerationLog);
  } catch (error) {
    console.error('Error retrieving episode generation logs for podcast:', error);
    throw error;
  }
}

export async function getEpisodeGenerationLogByEpisode(episodeId: string): Promise<EpisodeGenerationLog | null> {
  try {
    const snapshot = await getDb().collection('episodeGenerationLogs')
      .where('episodeId', '==', episodeId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as EpisodeGenerationLog;
  } catch (error) {
    console.error('Error retrieving episode generation log for episode:', error);
    throw error;
  }
} 