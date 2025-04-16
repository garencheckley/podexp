import React, { useState, useEffect } from 'react';
import { EpisodeGenerationLog, EpisodeGenerationDecision } from '../services/api';
import '../styles/GenerationLogViewer.css';

interface GenerationLogViewerProps {
  logId?: string;
  episodeId?: string;
  onError?: (error: Error) => void;
}

/**
 * A component that displays a detailed view of the episode generation process
 */
const GenerationLogViewer: React.FC<GenerationLogViewerProps> = ({ logId, episodeId, onError }) => {
  const [log, setLog] = useState<EpisodeGenerationLog | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLog() {
      try {
        setLoading(true);
        
        if (!logId && !episodeId) {
          throw new Error('Either logId or episodeId must be provided');
        }
        
        let response;
        
        if (logId) {
          response = await fetch(`/api/episode-logs/${logId}`);
        } else {
          response = await fetch(`/api/episodes/${episodeId}/generation-log`);
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch generation log: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setLog(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error.message);
        if (onError) {
          onError(error);
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchLog();
  }, [logId, episodeId, onError]);

  if (loading) {
    return <div className="generation-log-loading">Loading generation log...</div>;
  }
  
  if (error) {
    return <div className="generation-log-error">Error: {error}</div>;
  }
  
  if (!log) {
    return <div className="generation-log-not-found">Generation log not found</div>;
  }
  
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };
  
  const stageLabels: Record<string, string> = {
    episodeAnalysis: 'Episode Analysis',
    initialSearch: 'Initial Search',
    clustering: 'Topic Clustering',
    prioritization: 'Topic Prioritization',
    deepResearch: 'Deep Research',
    contentGeneration: 'Content Generation',
    audioGeneration: 'Audio Generation'
  };

  const renderStageDetails = (stage: string) => {
    const stageData = log.stages[stage as keyof typeof log.stages];
    
    if (!stageData) {
      return <div>No data available for this stage</div>;
    }
    
    // Decisions related to this stage
    const stageDecisions = log.decisions.filter(d => d.stage === stage);
    
    // Render different content based on the stage
    let stageSpecificContent;
    
    switch (stage) {
      case 'episodeAnalysis':
        stageSpecificContent = (
          <div className="stage-data">
            <h4>Previous Episode Analysis</h4>
            <p>Analyzed {stageData.episodeCount} episodes</p>
            
            {stageData.recentTopics && stageData.recentTopics.length > 0 && (
              <div className="data-section">
                <h5>Recent Topics</h5>
                <ul>
                  {stageData.recentTopics.map((topic, idx) => (
                    <li key={idx}>
                      {topic.topic} (mentioned {topic.frequency} times)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {stageData.recurrentThemes && stageData.recurrentThemes.length > 0 && (
              <div className="data-section">
                <h5>Recurrent Themes</h5>
                <ul>
                  {stageData.recurrentThemes.map((theme, idx) => (
                    <li key={idx}>{theme}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
        break;
        
      case 'initialSearch':
        stageSpecificContent = (
          <div className="stage-data">
            <h4>Initial Search Results</h4>
            
            {stageData.potentialTopics && stageData.potentialTopics.length > 0 && (
              <div className="data-section">
                <h5>Potential Topics Found</h5>
                <ul>
                  {stageData.potentialTopics.map((topic, idx) => (
                    <li key={idx}>
                      {topic.topic} (relevance: {topic.relevance}/10)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {stageData.relevantSources && stageData.relevantSources.length > 0 && (
              <div className="data-section">
                <h5>Sources</h5>
                <ul className="sources-list">
                  {stageData.relevantSources.map((source, idx) => (
                    <li key={idx}>
                      <a href={source} target="_blank" rel="noopener noreferrer">{source}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
        break;
        
      case 'clustering':
        stageSpecificContent = (
          <div className="stage-data">
            <h4>Topic Clustering</h4>
            
            {stageData.clusters && Object.keys(stageData.clusters).length > 0 && (
              <div className="data-section">
                <h5>Topic Clusters</h5>
                {Object.entries(stageData.clusters).map(([clusterId, topics]) => (
                  <div key={clusterId} className="cluster">
                    <h6>Cluster {clusterId}</h6>
                    <ul>
                      {Array.isArray(topics) && topics.map((topic, idx) => (
                        <li key={idx}>{topic}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            
            {stageData.clusterSummaries && stageData.clusterSummaries.length > 0 && (
              <div className="data-section">
                <h5>Cluster Summaries</h5>
                {stageData.clusterSummaries.map((summary, idx) => (
                  <div key={idx} className="cluster-summary">
                    <h6>Cluster {summary.clusterId}</h6>
                    <p>{summary.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
        break;
        
      case 'prioritization':
        stageSpecificContent = (
          <div className="stage-data">
            <h4>Topic Prioritization</h4>
            
            <div className="data-section">
              <h5>Selected Topics</h5>
              {stageData.prioritizedTopics && stageData.prioritizedTopics.length > 0 ? (
                <ul className="prioritized-topics">
                  {stageData.prioritizedTopics.map((topic, idx) => (
                    <li key={idx} className="prioritized-topic">
                      <div className="topic-header">
                        <strong>{topic.topic}</strong>
                        <div className="topic-scores">
                          <span>Importance: {topic.importance}/10</span>
                          <span>Newsworthiness: {topic.newsworthiness}/10</span>
                          <span>Depth Potential: {topic.depthPotential}/10</span>
                        </div>
                      </div>
                      <div className="topic-rationale">
                        <p><strong>Why selected:</strong> {topic.rationale}</p>
                      </div>
                      {topic.keyQuestions && topic.keyQuestions.length > 0 && (
                        <div className="key-questions">
                          <strong>Key Questions:</strong>
                          <ul>
                            {topic.keyQuestions.map((q, qIdx) => (
                              <li key={qIdx}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No topics were prioritized</p>
              )}
            </div>
            
            {stageData.discardedTopics && stageData.discardedTopics.length > 0 && (
              <div className="data-section">
                <h5>Discarded Topics</h5>
                <ul>
                  {stageData.discardedTopics.map((topic, idx) => (
                    <li key={idx}>{topic}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {stageData.selectionReasoning && (
              <div className="data-section">
                <h5>Selection Reasoning</h5>
                <p>{stageData.selectionReasoning}</p>
              </div>
            )}
          </div>
        );
        break;
        
      case 'deepResearch':
        stageSpecificContent = (
          <div className="stage-data">
            <h4>Deep Research</h4>
            
            {stageData.researchedTopics && stageData.researchedTopics.length > 0 ? (
              <div className="data-section">
                <h5>Researched Topics</h5>
                {stageData.researchedTopics.map((topic, idx) => (
                  <div key={idx} className="researched-topic">
                    <h6>{topic.topic}</h6>
                    
                    <div className="research-metrics">
                      <span>Layers: {topic.layerCount}</span>
                      <span>Sources: {topic.sourcesConsulted.length}</span>
                    </div>
                    
                    {topic.keyInsights && topic.keyInsights.length > 0 && (
                      <div className="key-insights">
                        <strong>Key Insights:</strong>
                        <ul>
                          {topic.keyInsights.map((insight, insightIdx) => (
                            <li key={insightIdx}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {topic.sourcesConsulted && topic.sourcesConsulted.length > 0 && (
                      <div className="sources">
                        <strong>Sources:</strong>
                        <ul className="sources-list">
                          {topic.sourcesConsulted.map((source, sourceIdx) => (
                            <li key={sourceIdx}>
                              <a href={source} target="_blank" rel="noopener noreferrer">{source}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p>No topics were researched in depth</p>
            )}
          </div>
        );
        break;
        
      case 'contentGeneration':
        stageSpecificContent = (
          <div className="stage-data">
            <h4>Content Generation</h4>
            
            <div className="data-section">
              <h5>Generated Content</h5>
              <p><strong>Title:</strong> {stageData.generatedTitle}</p>
              <p><strong>Description:</strong> {stageData.generatedDescription}</p>
              <p><strong>Word Count:</strong> {stageData.estimatedWordCount} words</p>
              <p><strong>Estimated Duration:</strong> {Math.round(stageData.estimatedDuration * 10) / 10} minutes</p>
            </div>
            
            {stageData.topicDistribution && stageData.topicDistribution.length > 0 && (
              <div className="data-section">
                <h5>Topic Distribution</h5>
                <ul>
                  {stageData.topicDistribution.map((topic, idx) => (
                    <li key={idx}>
                      {topic.topic}: {topic.allocation}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
        break;
        
      case 'audioGeneration':
        stageSpecificContent = (
          <div className="stage-data">
            <h4>Audio Generation</h4>
            <p><strong>Audio Duration:</strong> {Math.round(stageData.audioDuration * 10) / 10} minutes</p>
          </div>
        );
        break;
        
      default:
        stageSpecificContent = (
          <div className="stage-data">
            <pre>{JSON.stringify(stageData, null, 2)}</pre>
          </div>
        );
    }
    
    return (
      <div className="stage-details">
        {stageSpecificContent}
        
        {stageDecisions.length > 0 && (
          <div className="stage-decisions">
            <h4>Decisions</h4>
            {stageDecisions.map((decision, idx) => (
              <div key={idx} className="decision">
                <div className="decision-header">
                  <strong>{decision.decision}</strong>
                  <span className="decision-time">{formatTimestamp(decision.timestamp)}</span>
                </div>
                <p className="decision-reasoning">{decision.reasoning}</p>
                
                {decision.alternatives && decision.alternatives.length > 0 && (
                  <div className="decision-alternatives">
                    <strong>Alternatives Considered:</strong>
                    <ul>
                      {decision.alternatives.map((alt, altIdx) => (
                        <li key={altIdx}>{alt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        <div className="stage-timing">
          <p>Processing time: {formatDuration(stageData.processingTimeMs)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="generation-log-viewer">
      <div className="log-header">
        <h2>Episode Generation Process</h2>
        <div className="log-meta">
          <p><strong>Created:</strong> {formatTimestamp(log.timestamp)}</p>
          <p><strong>Status:</strong> <span className={`status-${log.status}`}>{log.status}</span></p>
          <p><strong>Total Duration:</strong> {formatDuration(log.duration.totalMs)}</p>
        </div>
      </div>
      
      <div className="generation-timeline">
        {Object.entries(log.stages).map(([stage, data]) => {
          if (!data) return null;
          const stageKey = stage as keyof typeof log.stages;
          const percentage = Math.round((log.duration.stageBreakdown[stageKey] / log.duration.totalMs) * 100);
          
          return (
            <div 
              key={stage}
              className={`timeline-stage ${activeStage === stage ? 'active' : ''} ${!data ? 'incomplete' : ''}`}
              style={{ width: `${percentage}%` }}
              onClick={() => setActiveStage(activeStage === stage ? null : stage)}
            >
              <div className="stage-label">{stageLabels[stage] || stage}</div>
              <div className="stage-time">{formatDuration(log.duration.stageBreakdown[stageKey])}</div>
            </div>
          );
        })}
      </div>
      
      {activeStage && (
        <div className="active-stage-details">
          <h3>{stageLabels[activeStage] || activeStage}</h3>
          {renderStageDetails(activeStage)}
        </div>
      )}
      
      <div className="log-footer">
        <p className="log-id">Log ID: {log.id}</p>
      </div>
    </div>
  );
};

export default GenerationLogViewer; 