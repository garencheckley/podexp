import { GoogleGenerativeAI } from '@google/generative-ai';
import { EpisodePlan } from './searchOrchestrator';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const modelId = 'gemini-2.0-flash';
const model = genAI.getGenerativeModel({ model: modelId });

/**
 * Interface for enhanced narrative structure
 */
export interface NarrativeStructure {
  introduction: {
    approach: string;
    topics: string;
    hook: string;
    wordCount: number;
  };
  bodySections: Array<{
    sectionTitle: string;
    topicReference: string;
    contentApproach: string;
    keyPoints: string[];
    transitions: {
      leadIn: string;
      leadOut: string;
    };
    wordCount: number;
  }>;
  conclusion: {
    summarizationApproach: string;
    finalThoughts: string;
    wordCount: number;
  };
  overallWordCount: number;
  adherenceMetrics: {
    structureScore: number;
    balanceScore: number;
    transitionScore: number;
    overallAdherence: number;
  };
}

/**
 * Creates an enhanced narrative structure based on the episode plan
 * @param episodePlan Basic episode plan from searchOrchestrator
 * @param targetWordCount Target word count for the entire episode
 * @returns Enhanced narrative structure with detailed section planning
 */
export async function createNarrativeStructure(
  episodePlan: EpisodePlan,
  targetWordCount: number
): Promise<NarrativeStructure> {
  try {
    console.log('Creating enhanced narrative structure for episode');
    
    const prompt = `
      Create a detailed narrative structure for a podcast episode based on this basic plan.
      
      Episode title: ${episodePlan.episodeTitle}
      
      Selected topics:
      ${episodePlan.selectedTopics.map((topic, index) => 
        `${index + 1}. ${topic.topic} (depth: ${topic.targetDepth})`
      ).join('\n')}
      
      Target total word count: ${targetWordCount} words
      
      Develop a complete narrative structure with these components:
      
      1. Introduction section:
         - A compelling approach to introduce the main themes
         - A hook to engage listeners
         - Word count allocation (typically 10-15% of total)
      
      2. Body sections (one for each topic):
         - Section title
         - Topic reference (which selected topic this covers)
         - Content approach (how to present this topic)
         - Key points to include
         - Transitions in and out of the section
         - Word count allocation (based on topic depth: deep > medium > overview)
      
      3. Conclusion section:
         - Summarization approach
         - Final thoughts or call to action
         - Word count allocation (typically 10-15% of total)
      
      Allocate the ${targetWordCount} words across all sections, giving more words to 
      deeper topics and ensuring the total adds up correctly.
      
      Respond in JSON format:
      {
        "introduction": {
          "approach": "Description of introduction approach",
          "topics": "Brief mention of topics to be covered",
          "hook": "Engaging hook to start the episode",
          "wordCount": 100
        },
        "bodySections": [
          {
            "sectionTitle": "Compelling section title",
            "topicReference": "Reference to original topic",
            "contentApproach": "How to present this topic",
            "keyPoints": ["Key point 1", "Key point 2", ...],
            "transitions": {
              "leadIn": "Transition into this section",
              "leadOut": "Transition to next section"
            },
            "wordCount": 150
          },
          ...
        ],
        "conclusion": {
          "summarizationApproach": "How to summarize the episode",
          "finalThoughts": "Closing thoughts or call to action",
          "wordCount": 100
        },
        "overallWordCount": ${targetWordCount}
      }
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const structureResult = JSON.parse(cleanedResponse);
      
      // Validate the basic structure and add default adherence metrics
      if (!structureResult.introduction || 
          !Array.isArray(structureResult.bodySections) || 
          !structureResult.conclusion) {
        throw new Error('Invalid narrative structure format');
      }
      
      // Add adherence metrics that will be updated later
      const narrativeStructure: NarrativeStructure = {
        ...structureResult,
        adherenceMetrics: {
          structureScore: 0,
          balanceScore: 0,
          transitionScore: 0,
          overallAdherence: 0
        }
      };
      
      // Validate the word count allocations
      const totalAllocated = 
        narrativeStructure.introduction.wordCount +
        narrativeStructure.bodySections.reduce((sum, section) => sum + section.wordCount, 0) +
        narrativeStructure.conclusion.wordCount;
      
      console.log(`Narrative structure created with ${narrativeStructure.bodySections.length} body sections`);
      console.log(`Word count allocation: ${totalAllocated}/${targetWordCount} words`);
      
      if (Math.abs(totalAllocated - targetWordCount) > targetWordCount * 0.05) {
        console.warn(`Word count allocation differs significantly from target (${totalAllocated} vs ${targetWordCount})`);
        // Fix word counts to match target exactly
        const adjustmentFactor = targetWordCount / totalAllocated;
        narrativeStructure.introduction.wordCount = Math.round(narrativeStructure.introduction.wordCount * adjustmentFactor);
        narrativeStructure.conclusion.wordCount = Math.round(narrativeStructure.conclusion.wordCount * adjustmentFactor);
        for (let i = 0; i < narrativeStructure.bodySections.length; i++) {
          narrativeStructure.bodySections[i].wordCount = Math.round(narrativeStructure.bodySections[i].wordCount * adjustmentFactor);
        }
        narrativeStructure.overallWordCount = targetWordCount;
      }
      
      return narrativeStructure;
    } catch (parseError) {
      console.error('Error parsing narrative structure:', parseError);
      return createFallbackNarrativeStructure(episodePlan, targetWordCount);
    }
  } catch (error) {
    console.error('Error creating narrative structure:', error);
    return createFallbackNarrativeStructure(episodePlan, targetWordCount);
  }
}

/**
 * Creates a fallback narrative structure if the AI generation fails
 * @param episodePlan Basic episode plan
 * @param targetWordCount Target word count
 * @returns Basic narrative structure
 */
function createFallbackNarrativeStructure(
  episodePlan: EpisodePlan,
  targetWordCount: number
): NarrativeStructure {
  console.log('Creating fallback narrative structure');
  
  // Calculate basic word count distribution
  const introWordCount = Math.round(targetWordCount * 0.15);
  const conclusionWordCount = Math.round(targetWordCount * 0.15);
  const bodyTotalWordCount = targetWordCount - introWordCount - conclusionWordCount;
  
  // Distribute remaining words among body sections
  const topics = episodePlan.selectedTopics;
  const bodySections = topics.map((topic, index) => {
    // Calculate word count based on depth
    let depthMultiplier = 1;
    if (topic.targetDepth === 'deep') depthMultiplier = 1.5;
    if (topic.targetDepth === 'overview') depthMultiplier = 0.7;
    
    // Basic weighted distribution
    const baseWordCount = bodyTotalWordCount / topics.length;
    const weightedWordCount = Math.round(baseWordCount * depthMultiplier);
    
    // Create section
    return {
      sectionTitle: `Section on ${topic.topic}`,
      topicReference: topic.topic,
      contentApproach: `Standard approach to ${topic.topic}`,
      keyPoints: topic.angles.slice(0, 3),
      transitions: {
        leadIn: index === 0 ? 
          "Let's begin by exploring" : 
          "Moving on to our next topic",
        leadOut: index === topics.length - 1 ? 
          "Having covered all our topics" : 
          "Let's continue with our next topic"
      },
      wordCount: weightedWordCount
    };
  });
  
  // Adjust word counts to exactly match target
  let totalBodyWords = bodySections.reduce((sum, section) => sum + section.wordCount, 0);
  const adjustment = bodyTotalWordCount - totalBodyWords;
  if (adjustment !== 0 && bodySections.length > 0) {
    bodySections[0].wordCount += adjustment;
  }
  
  return {
    introduction: {
      approach: "Start with a clear overview of the episode topics",
      topics: episodePlan.selectedTopics.map(t => t.topic).join(', '),
      hook: `Today we're exploring ${episodePlan.episodeTitle}, a fascinating topic with many dimensions.`,
      wordCount: introWordCount
    },
    bodySections,
    conclusion: {
      summarizationApproach: "Recap key points from each section",
      finalThoughts: "Leave the listener with a final insight about the overall topic",
      wordCount: conclusionWordCount
    },
    overallWordCount: targetWordCount,
    adherenceMetrics: {
      structureScore: 0,
      balanceScore: 0,
      transitionScore: 0,
      overallAdherence: 0
    }
  };
}

/**
 * Evaluates how well the generated content adheres to the narrative structure
 * @param generatedContent The actual content that was generated
 * @param narrativeStructure The planned narrative structure
 * @returns Updated narrative structure with adherence metrics
 */
export async function evaluateContentAdherence(
  generatedContent: string,
  narrativeStructure: NarrativeStructure
): Promise<NarrativeStructure> {
  try {
    console.log('Evaluating content adherence to narrative structure');
    
    const prompt = `
      Evaluate how well this generated podcast episode content adheres to the planned narrative structure.
      
      Planned Narrative Structure:
      - Introduction (${narrativeStructure.introduction.wordCount} words)
        Hook: ${narrativeStructure.introduction.hook}
        
      - Body Sections:
        ${narrativeStructure.bodySections.map(section => 
          `${section.sectionTitle} (${section.wordCount} words)
           Key points: ${section.keyPoints.join(', ')}`
        ).join('\n\n        ')}
        
      - Conclusion (${narrativeStructure.conclusion.wordCount} words)
        Approach: ${narrativeStructure.conclusion.summarizationApproach}
      
      Generated Content:
      ${generatedContent.substring(0, 6000)}
      
      Evaluate on these criteria and provide scores from 0-100:
      1. Structure adherence - Does the content follow the planned section structure?
      2. Balance adherence - Does the content allocate appropriate word count to each section?
      3. Transition quality - Does the content use good transitions between sections?
      4. Overall adherence - Overall score for plan adherence
      
      Respond in JSON format:
      {
        "structureScore": 85,
        "balanceScore": 75,
        "transitionScore": 90,
        "overallAdherence": 83,
        "feedback": "Detailed feedback on adherence and suggestions for improvement"
      }
    `;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      const adherenceResult = JSON.parse(cleanedResponse);
      
      // Update adherence metrics in the narrative structure
      const updatedStructure = { ...narrativeStructure };
      updatedStructure.adherenceMetrics = {
        structureScore: adherenceResult.structureScore || 0,
        balanceScore: adherenceResult.balanceScore || 0,
        transitionScore: adherenceResult.transitionScore || 0,
        overallAdherence: adherenceResult.overallAdherence || 0
      };
      
      console.log(`Content adherence evaluation: overall score ${updatedStructure.adherenceMetrics.overallAdherence}`);
      if (adherenceResult.feedback) {
        console.log(`Feedback: ${adherenceResult.feedback}`);
      }
      
      return updatedStructure;
    } catch (parseError) {
      console.error('Error parsing adherence evaluation:', parseError);
      // Return original structure with default scores on error
      return narrativeStructure;
    }
  } catch (error) {
    console.error('Error evaluating content adherence:', error);
    // Return original structure with default scores on error
    return narrativeStructure;
  }
} 