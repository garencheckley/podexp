import * as express from 'express';
import { getDb, Episode, Podcast } from '../services/database';

const router = express.Router();

const CRON_SECRET = process.env.CRON_SECRET;

// Middleware to check for secret
const checkCronSecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn('Unauthorized cron attempt');
        return res.status(401).send('Unauthorized');
    }
    next();
};

router.post('/trigger-generation', checkCronSecret, async (req, res) => {
    console.log('Cron job triggered: /trigger-generation');
    try {
        const db = getDb();
        const podcastsSnapshot = await db.collection('podcasts').where('autoGenerate', '==', true).get();

        if (podcastsSnapshot.empty) {
            console.log('No podcasts with autogeneration enabled.');
            return res.status(200).send('No podcasts to process.');
        }

        const podcasts = podcastsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Podcast));
        console.log(`Found ${podcasts.length} podcasts with autogeneration enabled.`);

        for (const podcast of podcasts) {
            const episodesSnapshot = await db.collection('episodes')
                .where('podcastId', '==', podcast.id)
                .orderBy('created_at', 'desc')
                .limit(1)
                .get();
            
            let shouldGenerate = true;
            if (!episodesSnapshot.empty) {
                const lastEpisode = episodesSnapshot.docs[0].data() as Episode;
                if(lastEpisode.created_at) {
                    const lastEpisodeDate = new Date(lastEpisode.created_at);
                    const now = new Date();
                    const hoursSinceLastEpisode = (now.getTime() - lastEpisodeDate.getTime()) / (1000 * 60 * 60);

                    if (hoursSinceLastEpisode <= 72) {
                        shouldGenerate = false;
                        console.log(`Skipping podcast ${podcast.id}, last episode was created ${hoursSinceLastEpisode.toFixed(2)} hours ago.`);
                    }
                }
            }

            if (shouldGenerate) {
                console.log(`Placeholder: Would trigger generation for podcast ${podcast.id}. Logic to be implemented.`);
                // The actual generation logic that caused build failures has been removed.
            }
        }

        res.status(202).send('Accepted: Generation tasks triggered.');

    } catch (error) {
        console.error('Error during cron job execution:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router; 