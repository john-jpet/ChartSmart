export interface Track {
  id: string; // e.g., "itunes_1440850249"
  title: string; // "Blinding Lights"
  artistName: string; // "The Weeknd"
  albumName: string; // "After Hours"
  previewUrl: string | null; // 30-second AAC/MP3 URL
  playcount?: number; // Exact global plays from Last.fm
  popularity?: number; // 0-100 metric
  releaseYear?: number;
  artworkUrl?: string;
}

export interface Artist {
  id: string;
  name: string;
  listeners?: number;
  playcount?: number;
  imageUrl?: string;
}

export interface Album {
  id: string;
  title: string;
  artistName: string;
  tracks: Track[];
  artworkUrl?: string;
  releaseYear?: number;
}
