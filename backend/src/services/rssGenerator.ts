import { Podcast, Episode } from './database';

export function generateRssFeed(podcast: Podcast, episodes: Episode[]): string {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const podcastUrl = `${baseUrl}/podcasts/${podcast.id}`;
  const rssUrl = `${baseUrl}/api/podcasts/${podcast.id}/rss`;
  
  // Sort episodes by created_at in reverse chronological order
  const sortedEpisodes = [...episodes].sort((a, b) => {
    return new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime();
  });

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(podcast.title)}</title>
    <link>${podcastUrl}</link>
    <description>${escapeXml(podcast.description)}</description>
    <language>en-us</language>
    <itunes:author>${escapeXml(podcast.ownerEmail || 'Unknown')}</itunes:author>
    <itunes:image href="${baseUrl}/placeholder-cover.jpg"/>
    <itunes:category text="News"/>
    <itunes:explicit>false</itunes:explicit>
    ${sortedEpisodes.map(episode => generateEpisodeXml(episode, podcastUrl)).join('\n    ')}
  </channel>
</rss>`;

  return rssXml;
}

function generateEpisodeXml(episode: Episode, podcastUrl: string): string {
  const pubDate = new Date(episode.created_at!).toUTCString();
  const duration = '00:30:00'; // Default duration since we don't store it
  
  return `<item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.description)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${episode.id}</guid>
      <enclosure url="${episode.audioUrl}" type="audio/mpeg" length="0"/>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:summary>${escapeXml(episode.description)}</itunes:summary>
    </item>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
} 