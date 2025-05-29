import axios from 'axios';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const SONAR_PRO_MODEL = 'sonar-pro';

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    citation_tokens: number;
    num_search_queries: number;
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
    delta: {
      role: string;
      content: string;
    };
  }>;
}

export interface ExpertQuote {
  quote: string;
  source: string;
  context: string;
  credibility: string;
}

export interface PerplexityResearchResults {
  topic: string;
  recentDevelopments: {
    content: string;
    sources: string[];
    recency: string;
    keyEvents: string[];
  };
  expertQuotes: {
    quotes: ExpertQuote[];
    sources: string[];
    industryPerspectives: string[];
  };
  dataMetrics: {
    statistics: string[];
    metrics: string[];
    comparisons: string[];
    sources: string[];
  };
  competitiveAnalysis: {
    insights: string[];
    comparisons: string[];
    marketPositioning: string[];
    sources: string[];
  };
  futureImplications: {
    predictions: string[];
    trends: string[];
    expertForecasts: string[];
    sources: string[];
  };
  allSources: string[];
  totalCitations: number;
  processingTimeMs: number;
}

/**
 * Call Perplexity Sonar Pro API with a specific prompt
 */
async function callPerplexityAPI(prompt: string): Promise<{ content: string; sources: string[] }> {
  try {
    const response = await axios.post<PerplexityResponse>(
      PERPLEXITY_API_URL,
      {
        model: SONAR_PRO_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const content = response.data.choices[0].message.content;
    const sources = response.data.citations || [];
    
    console.log(`Perplexity API call completed. Usage: ${response.data.usage.total_tokens} tokens, ${response.data.usage.num_search_queries} searches`);
    
    return { content, sources };
  } catch (error) {
    console.error('Error calling Perplexity API:', error);
    return { content: '', sources: [] };
  }
}

/**
 * Research recent developments and breaking news
 */
async function researchRecentDevelopments(topic: string): Promise<{
  content: string;
  sources: string[];
  recency: string;
  keyEvents: string[];
}> {
  const prompt = `
    Find the most recent developments, breaking news, and emerging trends related to "${topic}" from the last 7 days.
    
    Focus on:
    1. Breaking news and major announcements
    2. Recent policy changes or regulatory updates
    3. New product launches or business developments
    4. Market movements and immediate impacts
    5. Timeline of recent events
    
    For each development, provide:
    - Specific date when it occurred
    - What exactly happened
    - Who was involved (companies, officials, organizations)
    - Immediate impact or significance
    - Current status or ongoing developments
    
    Format your response to include:
    - A chronological summary of key events
    - Specific dates and timeframes
    - Names of key players and organizations
    - Direct quotes from recent statements or reports
    - Links to authoritative sources
    
    Focus on developments that would be most relevant for a podcast discussion about ${topic}.
  `;

  const result = await callPerplexityAPI(prompt);
  
  // Extract key events from the content (simple parsing)
  const keyEvents = result.content
    .split('\n')
    .filter(line => line.includes('•') || line.includes('-') || line.match(/\d{1,2}\/\d{1,2}|\w+ \d{1,2}/))
    .map(line => line.trim())
    .filter(line => line.length > 10)
    .slice(0, 5);

  return {
    content: result.content,
    sources: result.sources,
    recency: 'Last 7 days',
    keyEvents
  };
}

/**
 * Research expert quotes and industry perspectives
 */
async function researchExpertQuotes(topic: string): Promise<{
  quotes: ExpertQuote[];
  sources: string[];
  industryPerspectives: string[];
}> {
  const prompt = `
    Find recent expert quotes, analyst opinions, and industry leader statements about "${topic}" from the last 14 days.
    
    Look for:
    1. Direct quotes from CEOs, executives, and industry leaders
    2. Analyst opinions from major research firms
    3. Expert commentary from academic institutions
    4. Government officials or regulatory body statements
    5. Industry association or think tank perspectives
    
    For each quote, provide:
    - The exact quote in quotation marks
    - Full name and title of the person quoted
    - Organization or company they represent
    - Date when the statement was made
    - Context of where/when they said it (interview, report, conference, etc.)
    - Why their perspective is credible and relevant
    
    Format as:
    "Exact quote" - [Name], [Title] at [Organization], [Date/Context]
    
    Focus on quotes that provide insight, analysis, or predictions rather than just basic facts.
    Include both optimistic and cautious/critical perspectives where available.
  `;

  const result = await callPerplexityAPI(prompt);
  
  // Parse quotes from the content
  const quotes: ExpertQuote[] = [];
  const lines = result.content.split('\n');
  
  for (const line of lines) {
    const quoteMatch = line.match(/"([^"]+)"\s*-\s*([^,]+),\s*([^,]+),?\s*(.*)/);
    if (quoteMatch) {
      quotes.push({
        quote: quoteMatch[1],
        source: `${quoteMatch[2]}, ${quoteMatch[3]}`,
        context: quoteMatch[4] || 'Recent statement',
        credibility: quoteMatch[3] || 'Industry expert'
      });
    }
  }

  // Extract industry perspectives
  const industryPerspectives = result.content
    .split('\n')
    .filter(line => line.includes('perspective') || line.includes('view') || line.includes('outlook'))
    .map(line => line.trim())
    .filter(line => line.length > 20)
    .slice(0, 3);

  return {
    quotes,
    sources: result.sources,
    industryPerspectives
  };
}

/**
 * Research statistical data and market metrics
 */
async function researchDataMetrics(topic: string): Promise<{
  statistics: string[];
  metrics: string[];
  comparisons: string[];
  sources: string[];
}> {
  const prompt = `
    Find the latest statistics, market data, performance metrics, and quantitative analysis for "${topic}".
    
    Look for:
    1. Market size, growth rates, and revenue figures
    2. User adoption, penetration rates, and usage statistics  
    3. Performance metrics and KPIs
    4. Year-over-year comparisons and trends
    5. Regional or demographic breakdowns
    6. Forecast numbers and projections
    
    For each statistic, provide:
    - The exact number or percentage
    - What it measures specifically
    - Time period it covers
    - Source of the data (research firm, company, government)
    - Date when the data was published
    - How it compares to previous periods
    
    Format as specific, citation-ready statements like:
    - "Market grew 23% year-over-year to $4.2 billion in Q3 2024 (Source: XYZ Research)"
    - "Adoption increased from 34% to 47% among enterprise customers (Company Q3 earnings)"
    
    Focus on recent data (last 3 months preferred) and include both absolute numbers and comparative metrics.
  `;

  const result = await callPerplexityAPI(prompt);
  
  // Extract statistics and metrics
  const allLines = result.content.split('\n').filter(line => line.trim().length > 0);
  
  const statistics = allLines
    .filter(line => line.match(/\d+%|\$[\d,]+|\d+\.\d+/) && (line.includes('grew') || line.includes('increased') || line.includes('reached')))
    .slice(0, 5);

  const metrics = allLines
    .filter(line => line.match(/\d+%|\$[\d,]+|\d+\.\d+/) && (line.includes('metric') || line.includes('KPI') || line.includes('performance')))
    .slice(0, 5);

  const comparisons = allLines
    .filter(line => line.includes('compared to') || line.includes('vs') || line.includes('year-over-year'))
    .slice(0, 3);

  return {
    statistics,
    metrics,
    comparisons,
    sources: result.sources
  };
}

/**
 * Research competitive analysis and market positioning
 */
async function researchCompetitiveAnalysis(topic: string): Promise<{
  insights: string[];
  comparisons: string[];
  marketPositioning: string[];
  sources: string[];
}> {
  const prompt = `
    Analyze the competitive landscape and market positioning related to "${topic}".
    
    Research:
    1. Key players and market leaders
    2. Recent competitive moves and strategic initiatives
    3. Market share data and competitive positioning
    4. New entrants and disrupting forces
    5. Competitive advantages and differentiation strategies
    6. Partnership and acquisition activity
    
    For each competitive insight, provide:
    - Specific companies or organizations involved
    - Market share percentages where available
    - Strategic moves and their timing
    - Competitive advantages or weaknesses
    - Expert analysis of positioning
    - Recent changes in competitive dynamics
    
    Focus on actionable insights that explain:
    - Who's winning and why
    - What strategies are working
    - Where market gaps exist
    - How competitive landscape is evolving
    
    Include specific examples with company names, dates, and concrete outcomes.
  `;

  const result = await callPerplexityAPI(prompt);
  
  // Extract competitive insights
  const allLines = result.content.split('\n').filter(line => line.trim().length > 0);
  
  const insights = allLines
    .filter(line => line.includes('market') || line.includes('competitive') || line.includes('leader'))
    .slice(0, 4);

  const comparisons = allLines
    .filter(line => (line.includes('vs') || line.includes('compared') || line.includes('versus')) && line.length > 30)
    .slice(0, 3);

  const marketPositioning = allLines
    .filter(line => line.includes('position') || line.includes('strategy') || line.includes('advantage'))
    .slice(0, 3);

  return {
    insights,
    comparisons,
    marketPositioning,
    sources: result.sources
  };
}

/**
 * Research future implications and predictions
 */
async function researchFutureImplications(topic: string): Promise<{
  predictions: string[];
  trends: string[];
  expertForecasts: string[];
  sources: string[];
}> {
  const prompt = `
    Research future predictions, forecasts, and potential implications for "${topic}".
    
    Look for:
    1. Expert predictions for the next 6-12 months
    2. Emerging trends that will impact the space
    3. Regulatory or policy changes on the horizon
    4. Technology developments that could be disruptive
    5. Economic or market factors that may influence outcomes
    6. Long-term implications and potential scenarios
    
    For each prediction or trend, include:
    - Specific timeframe for when it's expected
    - Who is making the prediction (analyst, executive, expert)
    - What evidence supports this forecast
    - Potential impact or significance
    - Confidence level or caveats mentioned
    - Different scenarios (optimistic vs pessimistic)
    
    Focus on predictions that are:
    - Specific and measurable where possible
    - From credible sources with expertise
    - Relevant to podcast audience
    - Likely to drive meaningful discussion
    
    Include both mainstream consensus views and contrarian perspectives.
  `;

  const result = await callPerplexityAPI(prompt);
  
  // Extract predictions and trends
  const allLines = result.content.split('\n').filter(line => line.trim().length > 0);
  
  const predictions = allLines
    .filter(line => line.includes('predict') || line.includes('forecast') || line.includes('expect'))
    .slice(0, 4);

  const trends = allLines
    .filter(line => line.includes('trend') || line.includes('emerging') || line.includes('growing'))
    .slice(0, 4);

  const expertForecasts = allLines
    .filter(line => line.includes('analyst') || line.includes('expert') || line.includes('research'))
    .filter(line => line.includes('2024') || line.includes('2025') || line.includes('next'))
    .slice(0, 3);

  return {
    predictions,
    trends,
    expertForecasts,
    sources: result.sources
  };
}

/**
 * Main function to conduct comprehensive Perplexity research on a topic
 */
export async function conductPerplexityResearch(topic: string): Promise<PerplexityResearchResults> {
  console.log(`Starting comprehensive Perplexity research for topic: ${topic}`);
  const startTime = Date.now();
  
  try {
    // Execute all research calls in parallel for efficiency
    const [
      recentDevelopments,
      expertQuotes,
      dataMetrics,
      competitiveAnalysis,
      futureImplications
    ] = await Promise.all([
      researchRecentDevelopments(topic),
      researchExpertQuotes(topic),
      researchDataMetrics(topic),
      researchCompetitiveAnalysis(topic),
      researchFutureImplications(topic)
    ]);

    // Combine all sources
    const allSources = [
      ...new Set([
        ...recentDevelopments.sources,
        ...expertQuotes.sources,
        ...dataMetrics.sources,
        ...competitiveAnalysis.sources,
        ...futureImplications.sources
      ])
    ];

    const totalCitations = allSources.length;
    const processingTimeMs = Date.now() - startTime;

    console.log(`Perplexity research completed for ${topic}: ${totalCitations} citations in ${processingTimeMs}ms`);

    return {
      topic,
      recentDevelopments,
      expertQuotes,
      dataMetrics,
      competitiveAnalysis,
      futureImplications,
      allSources,
      totalCitations,
      processingTimeMs
    };
  } catch (error) {
    console.error(`Error conducting Perplexity research for ${topic}:`, error);
    
    // Return empty results structure to maintain consistency
    return {
      topic,
      recentDevelopments: { content: '', sources: [], recency: '', keyEvents: [] },
      expertQuotes: { quotes: [], sources: [], industryPerspectives: [] },
      dataMetrics: { statistics: [], metrics: [], comparisons: [], sources: [] },
      competitiveAnalysis: { insights: [], comparisons: [], marketPositioning: [], sources: [] },
      futureImplications: { predictions: [], trends: [], expertForecasts: [], sources: [] },
      allSources: [],
      totalCitations: 0,
      processingTimeMs: Date.now() - startTime
    };
  }
} 