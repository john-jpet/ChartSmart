import { Category } from "./seedTracks";

export interface SeedMovie {
  tmdbId: number;
  title: string;
  releaseYear: number;
  scoreTitle: string;
  composer: string;
}

/** Popular films with a deliberately selected score cue for the experimental movie game. */
export const SEED_MOVIES: SeedMovie[] = [
  { tmdbId: 238, title: "The Godfather", releaseYear: 1972, scoreTitle: "The Godfather Waltz", composer: "Nino Rota" },
  { tmdbId: 11, title: "Star Wars", releaseYear: 1977, scoreTitle: "Main Title", composer: "John Williams" },
  { tmdbId: 578, title: "Jaws", releaseYear: 1975, scoreTitle: "Main Title and First Victim", composer: "John Williams" },
  { tmdbId: 694, title: "The Shining", releaseYear: 1980, scoreTitle: "The Shining Main Title", composer: "Wendy Carlos" },
  { tmdbId: 1891, title: "The Empire Strikes Back", releaseYear: 1980, scoreTitle: "The Imperial March", composer: "John Williams" },
  { tmdbId: 85, title: "Raiders of the Lost Ark", releaseYear: 1981, scoreTitle: "The Raiders March", composer: "John Williams" },
  { tmdbId: 78, title: "Blade Runner", releaseYear: 1982, scoreTitle: "Main Titles", composer: "Vangelis" },
  { tmdbId: 601, title: "E.T. the Extra-Terrestrial", releaseYear: 1982, scoreTitle: "Flying", composer: "John Williams" },
  { tmdbId: 105, title: "Back to the Future", releaseYear: 1985, scoreTitle: "Back to the Future", composer: "Alan Silvestri" },
  { tmdbId: 679, title: "Aliens", releaseYear: 1986, scoreTitle: "Main Title", composer: "James Horner" },
  { tmdbId: 562, title: "Die Hard", releaseYear: 1988, scoreTitle: "The Nakatomi Plaza", composer: "Michael Kamen" },
  { tmdbId: 89, title: "Indiana Jones and the Last Crusade", releaseYear: 1989, scoreTitle: "Scherzo for Motorcycle and Orchestra", composer: "John Williams" },
  { tmdbId: 280, title: "Terminator 2: Judgment Day", releaseYear: 1991, scoreTitle: "Main Title", composer: "Brad Fiedel" },
  { tmdbId: 329, title: "Jurassic Park", releaseYear: 1993, scoreTitle: "Theme From Jurassic Park", composer: "John Williams" },
  { tmdbId: 13, title: "Forrest Gump", releaseYear: 1994, scoreTitle: "I'm Forrest... Forrest Gump", composer: "Alan Silvestri" },
  { tmdbId: 807, title: "Se7en", releaseYear: 1995, scoreTitle: "The Last Seven Days", composer: "Howard Shore" },
  { tmdbId: 862, title: "Toy Story", releaseYear: 1995, scoreTitle: "You've Got a Friend in Me", composer: "Randy Newman" },
  { tmdbId: 597, title: "Titanic", releaseYear: 1997, scoreTitle: "Rose", composer: "James Horner" },
  { tmdbId: 603, title: "The Matrix", releaseYear: 1999, scoreTitle: "Main Title / Trinity Infinity", composer: "Don Davis" },
  { tmdbId: 550, title: "Fight Club", releaseYear: 1999, scoreTitle: "Who Is Tyler Durden?", composer: "The Dust Brothers" },
  { tmdbId: 98, title: "Gladiator", releaseYear: 2000, scoreTitle: "The Battle", composer: "Hans Zimmer" },
  { tmdbId: 120, title: "The Lord of the Rings: The Fellowship of the Ring", releaseYear: 2001, scoreTitle: "The Shire", composer: "Howard Shore" },
  { tmdbId: 671, title: "Harry Potter and the Philosopher's Stone", releaseYear: 2001, scoreTitle: "Hedwig's Theme", composer: "John Williams" },
  { tmdbId: 27205, title: "Inception", releaseYear: 2010, scoreTitle: "Dream Is Collapsing", composer: "Hans Zimmer" },
  { tmdbId: 12445, title: "Harry Potter and the Deathly Hallows: Part 2", releaseYear: 2011, scoreTitle: "Lily's Theme", composer: "Alexandre Desplat" },
  { tmdbId: 49026, title: "The Dark Knight Rises", releaseYear: 2012, scoreTitle: "Gotham's Reckoning", composer: "Hans Zimmer" },
  { tmdbId: 68718, title: "Django Unchained", releaseYear: 2012, scoreTitle: "Django", composer: "Luis Bacalov" },
  { tmdbId: 157336, title: "Interstellar", releaseYear: 2014, scoreTitle: "Cornfield Chase", composer: "Hans Zimmer" },
  { tmdbId: 118340, title: "Guardians of the Galaxy", releaseYear: 2014, scoreTitle: "Black Tears", composer: "Tyler Bates" },
  { tmdbId: 76341, title: "Mad Max: Fury Road", releaseYear: 2015, scoreTitle: "Brothers in Arms", composer: "Junkie XL" },
  { tmdbId: 313369, title: "La La Land", releaseYear: 2016, scoreTitle: "Mia & Sebastian's Theme", composer: "Justin Hurwitz" },
  { tmdbId: 324857, title: "Spider-Man: Into the Spider-Verse", releaseYear: 2018, scoreTitle: "What's Up Danger", composer: "Blackway & Black Caviar" },
  { tmdbId: 496243, title: "Parasite", releaseYear: 2019, scoreTitle: "The Belt of Faith", composer: "Jung Jae-il" },
  { tmdbId: 475557, title: "Joker", releaseYear: 2019, scoreTitle: "Bathroom Dance", composer: "Hildur Gudnadottir" },
  { tmdbId: 530915, title: "1917", releaseYear: 2019, scoreTitle: "The Night Window", composer: "Thomas Newman" },
  { tmdbId: 438631, title: "Dune", releaseYear: 2021, scoreTitle: "Paul's Dream", composer: "Hans Zimmer" },
  { tmdbId: 634649, title: "Spider-Man: No Way Home", releaseYear: 2021, scoreTitle: "Arachnoverture", composer: "Michael Giacchino" },
  { tmdbId: 361743, title: "Top Gun: Maverick", releaseYear: 2022, scoreTitle: "Main Titles", composer: "Lorne Balfe" },
  { tmdbId: 872585, title: "Oppenheimer", releaseYear: 2023, scoreTitle: "Can You Hear the Music", composer: "Ludwig Goransson" },
  { tmdbId: 693134, title: "Dune: Part Two", releaseYear: 2024, scoreTitle: "A Time of Quiet Between the Storms", composer: "Hans Zimmer" },
];

export function moviesForCategory(category: Category): SeedMovie[] {
  if (category === "general") return SEED_MOVIES;
  const decade = Number(category.slice(0, 4));
  return SEED_MOVIES.filter((movie) => Math.floor(movie.releaseYear / 10) * 10 === decade);
}
