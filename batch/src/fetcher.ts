import ThemeParksClient, { LiveStatusType } from './themeparks';

export interface AttractionRecord {
  id: string;
  name: string;
  status: LiveStatusType;
  queue?: any;
}

export interface ParkAttractions {
  parkId: string;
  parkName: string;
  attractions: AttractionRecord[];
}

/**
 * Fetches Disneyland Resort parks and returns live attraction data for each park.
 * @param apiUrl Optional base URL for the ThemeParks API (defaults to official URL)
 * @param apiKey Optional bearer token (if required by the API)
 */
export async function fetchData(apiUrl?: string, apiKey?: string): Promise<ParkAttractions[]> {
  const client = new ThemeParksClient(apiUrl ?? undefined, apiKey);

  const destinations = await client.getDestinations();
  const disney = destinations?.destinations?.find(d => d.name === 'Disneyland Resort');
  if (!disney) throw new Error('Disneyland Resort destination not found');

  const parks = disney.parks ?? [];
  const results: ParkAttractions[] = [];

  for (const park of parks) {
    try {
      const liveResp = await client.getEntityLiveData(park.id);
      const attractions = (liveResp.liveData ?? [])
        .filter((e: any) => e.entityType === 'ATTRACTION')
        .map((a: any) => ({
          id: a.id,
          name: a.name,
          status: a.status,
          queue: a.queue,
        }));

      results.push({ parkId: park.id, parkName: park.name, attractions });
    } catch (err) {
      // If a park fails, include it with empty attractions so storage knows it was attempted
      results.push({ parkId: park.id, parkName: park.name, attractions: [] });
    }
  }

  return results;
}

