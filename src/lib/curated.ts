/**
 * Starter collections curated by the APIverse maintainers. They contain real catalog ids and are
 * kept separate from the visitor's own saved collections. Membership is editorial; it is not a
 * statement that the pricing of each entry is verified (the UI shows each entry's own status).
 */
export interface StarterCollection {
  id: string;
  name: string;
  description: string;
  apiIds: string[];
}

export const STARTER_COLLECTIONS: StarterCollection[] = [
  {
    id: 'first-web-app',
    name: 'My first web app',
    description: 'Simple GET-based APIs with no authentication, good for learning fetch and rendering JSON.',
    apiIds: ['jsonplaceholder', 'pokeapi', 'restcountries', 'open-meteo', 'free-dictionary-api'],
  },
  {
    id: 'hackathon-no-key',
    name: 'Hackathon quick-starts (no key needed)',
    description: 'Entries that need no authentication, so you can start in minutes. Check each pricing status before relying on it.',
    apiIds: ['open-meteo', 'pokeapi', 'open-library', 'nominatim', 'hacker-news', 'wikipedia-api', 'open-trivia-db'],
  },
  {
    id: 'ai-projects',
    name: 'AI project APIs',
    description: 'Hosted model APIs plus one self-hosted option for local development.',
    apiIds: ['openai-api', 'anthropic-api', 'gemini-api', 'ollama'],
  },
  {
    id: 'weather-maps',
    name: 'Weather and maps',
    description: 'Forecasts, geocoding and location lookups for location-aware apps.',
    apiIds: ['open-meteo', 'openweathermap', 'nominatim', 'mapbox', 'ip-api', 'sunrise-sunset'],
  },
  {
    id: 'student-projects',
    name: 'Student projects',
    description: 'Books, reference and science data that suit coursework and learning projects.',
    apiIds: ['open-library', 'google-books', 'wikipedia-api', 'free-dictionary-api', 'nasa-open-apis', 'open-trivia-db'],
  },
];
