import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import { TopicOption } from '../services/api';

interface TopicSelectorProps {
  topicOptions: TopicOption[];
  onTopicSelect: (topic: TopicOption) => void;
  onCancel: () => void;
  onTimeout: () => void;
  timeoutSeconds?: number;
}

const TopicSelector: React.FC<TopicSelectorProps> = ({
  topicOptions,
  onTopicSelect,
  onCancel,
  onTimeout,
  timeoutSeconds = 90
}) => {
  const [remainingTime, setRemainingTime] = useState(timeoutSeconds);
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          setIsTimedOut(true);
          setTimeout(() => onTimeout(), 100); // Small delay to show 0 seconds
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressValue = ((timeoutSeconds - remainingTime) / timeoutSeconds) * 100;

  if (isTimedOut) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Time's up! Auto-selecting the most relevant topic...
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Choose a Topic for Your Next Episode
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select a topic below or wait {formatTime(remainingTime)} for auto-selection
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progressValue} 
            sx={{ 
              mt: 1, 
              height: 6, 
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: remainingTime > 30 ? '#4caf50' : remainingTime > 10 ? '#ff9800' : '#f44336'
              }
            }} 
          />
        </Box>

        <Stack spacing={2}>
          {topicOptions.map((topic) => (
            <Card 
              key={topic.id} 
              sx={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                }
              }}
              onClick={() => onTopicSelect(topic)}
            >
              <CardContent>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {topic.topic}
                    </Typography>
                    <Chip 
                      label={`${topic.relevance}/10`} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {topic.description}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip 
                      label={topic.recency} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {topic.reasoning}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button 
            variant="outlined" 
            onClick={onCancel}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              ml: 'auto'
            }}
          >
            Auto-selecting in {formatTime(remainingTime)}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
};

export default TopicSelector; 