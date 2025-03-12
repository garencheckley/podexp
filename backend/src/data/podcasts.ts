export interface Podcast {
  id: string;
  title: string;
  description: string;
}

export interface Episode {
  id: string;
  podcastId: string;
  episodeNumber: number;
  title: string;
  description: string;
  content: string;
  publishedAt: string;
}

// Hardcoded podcast data for Phase 1
export const podcasts: Podcast[] = [
  {
    id: "timmy-trex",
    title: "Timmy the T-Rex and his adventures",
    description: "Join Timmy, a young T-Rex, as he explores the prehistoric world and learns valuable lessons about friendship, courage, and being yourself."
  }
];

// Hardcoded episodes for Phase 1
export const episodes: Episode[] = [
  {
    id: "timmy-ep1",
    podcastId: "timmy-trex",
    episodeNumber: 1,
    title: "Making New Friends",
    description: "Timmy meets a young Triceratops named Trina and learns about making friends who are different from him.",
    content: "In the lush Cretaceous valley, Timmy the T-Rex was feeling lonely. Despite being from a family of fierce predators, Timmy wanted nothing more than to make friends. One sunny morning, he spotted a young Triceratops named Trina gathering flowers. Instead of running away like most dinosaurs did, Trina smiled and offered to share her favorite flower patch with Timmy. Together, they spent the day learning about each other's lives and discovering that the best friendships come from unexpected places.",
    publishedAt: "2024-03-20"
  },
  {
    id: "timmy-ep2",
    podcastId: "timmy-trex",
    episodeNumber: 2,
    title: "The Big Storm",
    description: "When a terrible storm hits the valley, Timmy must be brave and help his new friend Trina find shelter.",
    content: "Dark clouds gathered over the valley as Timmy and Trina played near the river. When the first raindrops fell, they knew this wasn't an ordinary storm. Thunder boomed and lightning flashed across the sky. Trina was scared of storms, but Timmy remembered the cave where his family often sheltered. Being careful to avoid the slippery mud, Timmy guided Trina to safety, learning that being brave means helping others even when you're scared yourself.",
    publishedAt: "2024-03-21"
  },
  {
    id: "timmy-ep3",
    podcastId: "timmy-trex",
    episodeNumber: 3,
    title: "The Sharing Lesson",
    description: "Timmy learns the importance of sharing when food becomes scarce in the valley.",
    content: "A dry spell had made food harder to find in the valley. While Timmy's family had their own secret hunting grounds, he noticed that Trina's family was struggling to find enough plants to eat. Remembering how Trina had shared her flower patch, Timmy convinced his family to share their knowledge of where to find food with the other dinosaurs. The valley's dinosaurs learned that by working together and sharing resources, everyone could have enough.",
    publishedAt: "2024-03-22"
  }
]; 