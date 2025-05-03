import * as express from 'express';
import { getEpisodeGenerationLog, getEpisodeGenerationLogsByPodcast, getEpisodeGenerationLogByEpisode } from '../services/logService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get an episode generation log by ID
router.get('/episode-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`GET /api/episode-logs/${id}`);
    
    const log = await getEpisodeGenerationLog(id);
    
    if (!log) {
      return res.status(404).json({ error: 'Episode generation log not found' });
    }
    
    res.json(log);
  } catch (error) {
    console.error('Error retrieving episode generation log:', error);
    res.status(500).json({ error: 'Failed to retrieve episode generation log' });
  }
});

// Get all episode generation logs for a podcast
router.get('/podcasts/:podcastId/episode-logs', async (req, res) => {
  try {
    const { podcastId } = req.params;
    console.log(`GET /api/podcasts/${podcastId}/episode-logs`);
    
    const logs = await getEpisodeGenerationLogsByPodcast(podcastId);
    
    res.json(logs);
  } catch (error) {
    console.error('Error retrieving episode generation logs for podcast:', error);
    res.status(500).json({ error: 'Failed to retrieve episode generation logs' });
  }
});

// Get episode generation log for a specific episode
router.get('/episodes/:episodeId/generation-log', async (req, res) => {
  try {
    const { episodeId } = req.params;
    console.log(`GET /api/episodes/${episodeId}/generation-log`);
    
    const log = await getEpisodeGenerationLogByEpisode(episodeId);
    
    if (!log) {
      return res.status(404).json({ error: 'Episode generation log not found' });
    }
    
    res.json(log);
  } catch (error) {
    console.error('Error retrieving episode generation log for episode:', error);
    res.status(500).json({ error: 'Failed to retrieve episode generation log' });
  }
});

export default router; 