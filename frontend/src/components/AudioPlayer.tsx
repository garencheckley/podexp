import React, { useState, useRef, useEffect } from 'react';

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

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const value = parseFloat(e.target.value);
    const newTime = (value / 100) * duration;
    audio.currentTime = newTime;
    setProgress(value);
  };

  // Format time in MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="audio-controls">
        <button 
          onClick={togglePlayPause} 
          className="play-pause-button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        
        <div className="progress-container">
          <span className="time">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="progress-bar"
            value={progress}
            onChange={handleProgressChange}
            step="0.1"
            min="0"
            max="100"
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer; 