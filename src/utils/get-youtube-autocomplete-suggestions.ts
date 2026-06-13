import {APIApplicationCommandOptionChoice} from 'discord-api-types/v10';
import getYouTubeSuggestionsFor from './get-youtube-suggestions-for.js';

export default async function getYouTubeAutocompleteSuggestions(query: string, limit = 10): Promise<APIApplicationCommandOptionChoice[]> {
  const youtubeSuggestions = await getYouTubeSuggestionsFor(query);

  return youtubeSuggestions
    .slice(0, limit)
    .map(suggestion => ({
      name: suggestion,
      value: suggestion,
    }));
}
