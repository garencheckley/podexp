import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert, 
  Button, 
  Paper,
  Stack,
  Divider,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Link as LinkIcon,
  Lightbulb as LightbulbIcon,
  Topic as TopicIcon,
  Timer as TimerIcon
} from '@mui/icons-material';
import { EpisodeGenerationLog, EpisodeGenerationDecision, getEpisodeGenerationLog, getEpisodeGenerationLogByEpisode } from '../services/api';

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
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    async function fetchLog() {
      try {
        setLoading(true);
        
        if (!logId && !episodeId) {
          throw new Error('Either logId or episodeId must be provided');
        }
        
        console.log('Fetching generation log with:', { logId, episodeId });
        
        let data: EpisodeGenerationLog;
        
        if (logId) {
          console.log('Fetching by logId:', logId);
          data = await getEpisodeGenerationLog(logId);
        } else if (episodeId) {
          console.log('Fetching by episodeId:', episodeId);
          data = await getEpisodeGenerationLogByEpisode(episodeId);
        } else {
          throw new Error('No valid ID provided for fetching generation log');
        }
        
        console.log('Received log data:', data);
        setLog(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('Error fetching generation log:', error);
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
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error: {error}
      </Alert>
    );
  }
  
  if (!log) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Generation log not found or incomplete for this episode.
      </Alert>
    );
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
    if (!log || !log.stages || !log.decisions) {
      return <Typography>No data available for this stage</Typography>;
    }
    const stageData = log.stages[stage as keyof typeof log.stages];
    if (!stageData || typeof stageData !== 'object') {
      return <Typography>No data available for this stage</Typography>;
    }
    
    // Decisions related to this stage
    const stageDecisions = Array.isArray(log.decisions) ? log.decisions.filter(d => d.stage === stage) : [];
    
    // Render different content based on the stage
    let stageSpecificContent = null;
    
    switch (stage) {
      case 'episodeAnalysis':
        stageSpecificContent = (
          <Stack spacing={2}>
            <Typography variant="h6">Previous Episode Analysis</Typography>
            <Typography>
              Analyzed {typeof stageData.episodeCount === 'number' ? stageData.episodeCount : 0} episodes
            </Typography>
            
            {Array.isArray(stageData.recentTopics) && stageData.recentTopics.length > 0 ? (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Recent Topics
                </Typography>
                <List>
                  {stageData.recentTopics.map((topic: { topic: string; frequency: number }, idx: number) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={topic.topic}
                        secondary={`Mentioned ${topic.frequency} times`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Typography>No recent topics available</Typography>
            )}
            
            {Array.isArray(stageData.recurrentThemes) && stageData.recurrentThemes.length > 0 ? (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Recurrent Themes
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {stageData.recurrentThemes.map((theme: string, idx: number) => (
                    <Chip key={idx} label={theme} />
                  ))}
                </Stack>
              </Box>
            ) : (
              <Typography>No recurrent themes available</Typography>
            )}
          </Stack>
        );
        break;
        
      case 'initialSearch':
        stageSpecificContent = (
          <Stack spacing={2}>
            <Typography variant="h6">Initial Search Results</Typography>
            
            {stageData.geminiPrompt && (
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<CodeIcon />}
                  onClick={() => setShowPrompt(v => !v)}
                >
                  {showPrompt ? 'Hide Prompt' : 'Show Prompt'}
                </Button>
                {showPrompt && (
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      mt: 1,
                      bgcolor: 'background.default',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {stageData.geminiPrompt}
                  </Paper>
                )}
              </Box>
            )}
            
            {stageData.potentialTopics && stageData.potentialTopics.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Potential Topics Found
                </Typography>
                <List>
                  {stageData.potentialTopics.map((topic: { topic: string, relevance: number }, idx: number) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={topic.topic}
                        secondary={`Relevance: ${topic.relevance}/10`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            
            {stageData.relevantSources && stageData.relevantSources.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Sources
                </Typography>
                <List>
                  {stageData.relevantSources.map((source: { url: string }, idx: number) => (
                    <ListItem key={idx}>
                      <Link
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <LinkIcon fontSize="small" />
                        {source.url}
                      </Link>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        );
        break;
        
      case 'deepResearch':
        stageSpecificContent = (
          <Stack spacing={2}>
            <Typography variant="h6">Deep Research</Typography>
            
            {stageData.researchedTopics && stageData.researchedTopics.length > 0 ? (
              <Stack spacing={2}>
                {stageData.researchedTopics.map((topic: { topic: string; layerCount: number; sourcesConsulted: { url: string }[]; keyInsights: string[] }, idx: number) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {topic.topic}
                    </Typography>
                    
                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                      <Chip
                        icon={<TopicIcon />}
                        label={`${topic.layerCount} layers`}
                        size="small"
                      />
                      <Chip
                        icon={<LinkIcon />}
                        label={`${topic.sourcesConsulted.length} sources`}
                        size="small"
                      />
                    </Stack>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Key Insights
                    </Typography>
                    <List dense>
                      {topic.keyInsights.map((insight: string, insightIdx: number) => (
                        <ListItem key={insightIdx}>
                          <ListItemText
                            primary={insight}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Sources Consulted
                    </Typography>
                    <List dense>
                      {topic.sourcesConsulted.map((source: { url: string }, sourceIdx: number) => (
                        <ListItem key={sourceIdx}>
                          <Link
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                          >
                            {source.url}
                          </Link>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography>No research data available</Typography>
            )}
          </Stack>
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
                  {stageData.topicDistribution.map((topic: { topic: string, allocation: number }, idx: number) => (
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
        
      case 'topic_selection':
        stageSpecificContent = (
          <div className="stage-data">
            <h4>Topic Selection</h4>
            <div className="data-section">
              <p>Selected topics based on newness and timeliness.</p>
              {stageData.selectedTopics && stageData.selectedTopics.length > 0 && (
                <ul>
                  {stageData.selectedTopics.map((topic: { topic: string }, idx: number) => (
                    <li key={idx}>{topic.topic}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
        break;
        
      default:
        stageSpecificContent = (
          <Typography>No specific content available for this stage</Typography>
        );
    }
    
    return (
      <Stack spacing={2}>
        {stageSpecificContent}
        
        {stageDecisions.length > 0 && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Decisions Made
            </Typography>
            <List>
              {stageDecisions.map((decision: EpisodeGenerationDecision, idx: number) => (
                <ListItem key={idx}>
                  <ListItemText
                    primary={decision.decision}
                    secondary={decision.reasoning}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Stack>
    );
  };

  return (
    <>
      {(!log || !log.stages || !log.timestamp || !log.duration || typeof log.duration.totalMs !== 'number') ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Generation log not found or incomplete for this episode.
        </Alert>
      ) : (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="h6">
                Generation Log
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Started: {formatTimestamp(log.timestamp)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Duration: {formatDuration(log.duration.totalMs)}
              </Typography>
            </Stack>
          </Paper>
          <Stack spacing={1}>
            {Object.keys(log.stages).map((stage) => {
              const stageData = log.stages[stage as keyof typeof log.stages];
              if (!stageData) return null;
              return (
                <Accordion
                  key={stage}
                  expanded={activeStage === stage}
                  onChange={() => setActiveStage(activeStage === stage ? null : stage)}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">
                        {stageLabels[stage] || stage}
                      </Typography>
                      <Chip
                        icon={<TimerIcon />}
                        label={stageData.duration ? formatDuration(stageData.duration) : ''}
                        size="small"
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    {renderStageDetails(stage)}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        </Stack>
      )}
    </>
  );
};

export default GenerationLogViewer; 