import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  IconButton, 
  Typography, 
  Slider, 
  Paper,
  Stack
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Replay5 as Replay5Icon,
  Forward5 as Forward5Icon
} from '@mui/icons-material';

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, title }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Auto-play when audioUrl changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Reset audio state for new URLs
    setProgress(0);
    setCurrentTime(0);
    
    // Play the audio automatically when loaded
    const playAudio = () => {
      audio.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(error => {
          console.error('Auto-play failed:', error);
          // Some browsers block auto-play without user interaction
          setIsPlaying(false);
        });
    };
    
    // Add event listener for canplay event
    audio.addEventListener('canplay', playAudio);
    
    // Clean up event listener
    return () => {
      audio.removeEventListener('canplay', playAudio);
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const setAudioProgress = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    // Add event listeners
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioProgress);
    audio.addEventListener('ended', () => setIsPlaying(false));

    // Clean up event listeners
    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioProgress);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, [audioRef]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (_: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newValue = value as number;
    const newTime = (newValue / 100) * duration;
    audio.currentTime = newTime;
    setProgress(newValue);
  };

  // Format time in MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Skip backward 15 seconds
  const skipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = Math.max(0, audio.currentTime - 15);
    audio.currentTime = newTime;
  };

  // Skip forward 15 seconds
  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = Math.min(audio.duration, audio.currentTime + 15);
    audio.currentTime = newTime;
  };

  return (
    <Paper 
      elevation={3}
      sx={{ 
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        p: 2,
        zIndex: 1000,
        borderRadius: 0
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <Stack spacing={1}>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            textAlign: 'center',
            fontWeight: 500
          }}
        >
          {title}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={skipBackward}
            size="small"
            aria-label="Skip backward 15 seconds"
          >
            <Replay5Icon />
          </IconButton>
          
          <IconButton 
            onClick={togglePlayPause}
            size="large"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          
          <IconButton 
            onClick={skipForward}
            size="small"
            aria-label="Skip forward 15 seconds"
          >
            <Forward5Icon />
          </IconButton>
          
          <Box sx={{ flex: 1, mx: 2 }}>
            <Slider
              value={progress}
              onChange={handleProgressChange}
              aria-label="Audio progress"
              size="small"
            />
          </Box>
          
          <Typography variant="caption" sx={{ minWidth: 45 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};

export default AudioPlayer; 