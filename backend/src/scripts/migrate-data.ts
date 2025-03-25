import { createPodcast, createEpisode } from '../services/database';

async function migrateData() {
  // Create first podcast
  const podcast1 = await createPodcast({
    title: 'Tech Talk Weekly',
    description: 'Weekly discussions about the latest in technology',
    episodes: []
  });

  // Create episodes for first podcast
  await createEpisode({
    podcastId: podcast1.id || '',
    title: 'The Future of AI',
    description: 'Exploring the latest developments in artificial intelligence',
    content: 'Exploring the latest developments in artificial intelligence',
    created_at: new Date().toISOString()
  });

  await createEpisode({
    podcastId: podcast1.id || '',
    title: 'Cloud Computing Trends',
    description: 'Discussion about modern cloud architecture and trends',
    content: 'Discussion about modern cloud architecture and trends',
    created_at: new Date().toISOString()
  });

  // Create second podcast
  const podcast2 = await createPodcast({
    title: 'Developer Stories',
    description: 'Real stories from software developers',
    episodes: []
  });

  // Create episodes for second podcast
  await createEpisode({
    podcastId: podcast2.id || '',
    title: 'My Journey into Tech',
    description: 'A developer shares their career journey',
    content: 'A developer shares their career journey',
    created_at: new Date().toISOString()
  });

  await createEpisode({
    podcastId: podcast2.id || '',
    title: 'Building Scalable Systems',
    description: 'Lessons learned from scaling applications',
    content: 'Lessons learned from scaling applications',
    created_at: new Date().toISOString()
  });

  console.log('Data migration completed successfully');
}

migrateData().catch(console.error); 