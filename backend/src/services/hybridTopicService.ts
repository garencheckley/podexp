import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeWebSearch } from './search';
import { EpisodeAnalysis } from './episodeAnalyzer';
import { Podcast } from './database';
import { POWERFUL_MODEL_ID } from '../config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const SONAR_MODEL = 'sonar';

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations: string[];
  object: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
}

/**
 * Interface for unified topic results
 */
export interface HybridTopicResult {
  topic: string;
  description: string;
  relevance: number;
  recency: string;
  sources: string[];
  keyQuestions: string[];
  apiSource: 'gemini' | 'perplexity' | 'hybrid';
  reasoning: string;
}

/**
 * Interface for the final topic recommendations
 */
export interface TopicRecommendations {
  topics: HybridTopicResult[];
  geminiResults: HybridTopicResult[];
  perplexityResults: HybridTopicResult[];
  hybridScore: number; // Quality score of the hybrid approach
  processingStats: {
    geminiSuccess: boolean;
    perplexitySuccess: boolean;
    totalTopics: number;
    processingTimeMs: number;
  };
}

/**
 * Search for topics using Perplexity's Sonar model with smart prompting
 */
async function searchTopicsWithPerplexity(
  podcast: Podcast,
  analysis: EpisodeAnalysis
): Promise<HybridTopicResult[]> {
  try {
    // Create a smart prompt optimized for Perplexity's real-time search capabilities
    const prompt = `
      You are a podcast topic research expert with access to real-time web data. Find the most compelling and timely topics for a new podcast episode.
      
      Podcast Context:
      - Title: ${podcast.title}
      - Description: ${podcast.description}
      - Focus: ${podcast.prompt || 'General interest based on title and description'}
      
      Recently Covered Topics (AVOID these):
      ${analysis.recentTopics.map(t => `- ${t.topic} (covered ${t.frequency} times)`).join('\n')}
      
      Requirements:
      1. Find 5-7 highly newsworthy topics from the LAST 7-10 DAYS
      2. Each topic must be directly relevant to the podcast's theme
      3. Prioritize breaking news, major developments, and trending stories
      4. Include authoritative sources and recent citations
      5. Focus on topics with sufficient depth for a 10-20 minute discussion
      
      For each topic, provide:
      - A compelling episode-ready title
      - Why it's newsworthy and relevant RIGHT NOW
      - Relevance score (1-10) to the podcast theme
      - Recency indicator (e.g., "breaking", "developing", "trending")
      - 2-3 key discussion points or questions
      - Supporting sources with URLs
      
      Format as JSON array:
      [
        {
          "topic": "Clear, engaging topic title",
          "description": "Why this is newsworthy and relevant now",
          "relevance": 8,
          "recency": "breaking/developing/trending",
          "sources": ["url1", "url2"],
          "keyQuestions": ["Question 1?", "Question 2?"],
          "reasoning": "Why this topic stands out"
        }
      ]
    `;

    const response = await axios.post<PerplexityResponse>(
      PERPLEXITY_API_URL,
      {
        model: SONAR_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content;
    
    try {
      const cleanedResponse = content.replace(/```json|```/g, '').trim();
      const topics = JSON.parse(cleanedResponse);
      
      if (Array.isArray(topics)) {
        return topics.map(topic => ({
          ...topic,
          apiSource: 'perplexity' as const
        }));
      } else {
        console.error('Invalid topic format from Perplexity:', content);
        return [];
      }
    } catch (parseError) {
      console.error('Error parsing Perplexity response:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error calling Perplexity API:', error);
    return [];
  }
}

/**
 * Search for topics using Gemini with smart prompting for analytical depth
 */
async function searchTopicsWithGemini(
  podcast: Podcast,
  analysis: EpisodeAnalysis
): Promise<HybridTopicResult[]> {
  try {
    // Create a smart prompt optimized for Gemini's analytical capabilities
    const sourceUrls = podcast.sources?.map(s => s.url).filter(url => !!url) || [];
    const sourceContext = sourceUrls.length > 0 
      ? `Preferred sources: ${sourceUrls.join(', ')}`
      : 'Use reputable major news outlets and authoritative sources';

    const prompt = `
      You are an expert podcast content strategist. Analyze current trends and developments to identify compelling episode topics that offer analytical depth and unique perspectives.
      
      Podcast Profile:
      - Title: ${podcast.title}
      - Description: ${podcast.description}
      - Editorial Focus: ${podcast.prompt || 'Engaging content based on podcast theme'}
      - ${sourceContext}
      
      Previous Episode Analysis:
      - Total episodes: ${analysis.episodeCount}
      - Recently covered: ${analysis.recentTopics.map(t => t.topic).join(', ')}
      - Avoid repetition of these themes
      
      Your Mission:
      Identify 5-7 topics that offer:
      1. Fresh angles on current events (last 14 days)
      2. Analytical depth beyond surface news
      3. Multiple perspectives and expert viewpoints
      4. Connection to broader trends or implications
      5. Strong storytelling potential
      
      For each topic, provide:
      - An analytical topic title that promises depth
      - Clear explanation of why this offers unique value
      - Relevance score considering both timeliness and depth potential
      - Recency classification
      - Thought-provoking questions that go beyond basic facts
      - Quality sources that support analytical discussion
      
      Format as JSON array:
      [
        {
          "topic": "Analytical topic title with depth",
          "description": "What makes this topic analytically compelling",
          "relevance": 8,
          "recency": "recent/ongoing/emerging",
          "sources": ["authoritative-source-url"],
          "keyQuestions": ["Deep question 1?", "Analytical question 2?"],
          "reasoning": "Why this offers unique analytical value"
        }
      ]
    `;

    const searchResult = await executeWebSearch(prompt);
    
    try {
      const cleanedResponse = searchResult.content.replace(/```json|```/g, '').trim();
      const topics = JSON.parse(cleanedResponse);
      
      if (Array.isArray(topics)) {
        return topics.map(topic => ({
          ...topic,
          apiSource: 'gemini' as const,
          sources: topic.sources || searchResult.sources || []
        }));
      } else {
        console.error('Invalid topic format from Gemini:', cleanedResponse);
        return [];
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return [];
  }
}

/**
 * Intelligently combines and ranks topics from both APIs
 */
function combineAndRankTopics(
  geminiTopics: HybridTopicResult[],
  perplexityTopics: HybridTopicResult[]
): HybridTopicResult[] {
  const allTopics = [...geminiTopics, ...perplexityTopics];
  
  // Remove duplicate topics (similar titles)
  const uniqueTopics: HybridTopicResult[] = [];
  const seenTopics = new Set<string>();
  
  for (const topic of allTopics) {
    const normalizedTitle = topic.topic.toLowerCase().trim();
    const isDuplicate = Array.from(seenTopics).some(seen => 
      normalizedTitle.includes(seen) || seen.includes(normalizedTitle)
    );
    
    if (!isDuplicate) {
      seenTopics.add(normalizedTitle);
      uniqueTopics.push(topic);
    }
  }
  
  // Score and rank topics
  const scoredTopics = uniqueTopics.map(topic => {
    let score = 0;
    
    // Base relevance score
    score += topic.relevance * 10;
    
    // Recency bonus
    const recencyBonus = {
      'breaking': 30,
      'developing': 25,
      'trending': 20,
      'recent': 15,
      'ongoing': 10,
      'emerging': 8
    };
    score += recencyBonus[topic.recency.toLowerCase()] || 5;
    
    // Source quality bonus
    score += topic.sources.length * 5;
    
    // API source bonus (slight preference for Perplexity's real-time data)
    if (topic.apiSource === 'perplexity') score += 5;
    if (topic.apiSource === 'gemini') score += 3;
    
    // Question depth bonus
    score += topic.keyQuestions.length * 3;
    
    return { ...topic, hybridScore: score };
  });
  
  // Sort by score and return top 8
  return scoredTopics
    .sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0))
    .slice(0, 8);
}

/**
 * Main function to get hybrid topic recommendations
 */
export async function getHybridTopicRecommendations(
  podcast: Podcast,
  analysis: EpisodeAnalysis
): Promise<TopicRecommendations> {
  const startTime = Date.now();
  
  console.log(`[Hybrid Topic Service] Starting topic discovery for podcast: ${podcast.title}`);
  
  // Execute both API calls in parallel
  const [geminiResults, perplexityResults] = await Promise.allSettled([
    searchTopicsWithGemini(podcast, analysis),
    searchTopicsWithPerplexity(podcast, analysis)
  ]);
  
  const geminiTopics = geminiResults.status === 'fulfilled' ? geminiResults.value : [];
  const perplexityTopics = perplexityResults.status === 'fulfilled' ? perplexityResults.value : [];
  
  console.log(`[Hybrid Topic Service] Gemini found ${geminiTopics.length} topics, Perplexity found ${perplexityTopics.length} topics`);
  
  // Combine and rank topics
  const combinedTopics = combineAndRankTopics(geminiTopics, perplexityTopics);
  
  // Calculate hybrid score based on success and diversity
  let hybridScore = 0;
  if (geminiTopics.length > 0) hybridScore += 40;
  if (perplexityTopics.length > 0) hybridScore += 40;
  hybridScore += Math.min(combinedTopics.length * 2, 20); // Bonus for topic count
  
  const processingTimeMs = Date.now() - startTime;
  
  console.log(`[Hybrid Topic Service] Combined to ${combinedTopics.length} unique topics with hybrid score ${hybridScore}`);
  
  return {
    topics: combinedTopics,
    geminiResults: geminiTopics,
    perplexityResults: perplexityTopics,
    hybridScore,
    processingStats: {
      geminiSuccess: geminiResults.status === 'fulfilled',
      perplexitySuccess: perplexityResults.status === 'fulfilled',
      totalTopics: combinedTopics.length,
      processingTimeMs
    }
  };
} 