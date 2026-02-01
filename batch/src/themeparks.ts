const DEFAULT_BASE = 'https://api.themeparks.wiki/v1';

// Minimal typed interfaces based on the OpenAPI spec (trimmed for brevity)
export type EntityType = 'DESTINATION' | 'PARK' | 'ATTRACTION' | 'RESTAURANT' | 'HOTEL' | 'SHOW';
export type LiveStatusType = 'OPERATING' | 'DOWN' | 'CLOSED' | 'REFURBISHMENT';

export interface TagData {
  tag: string;
  tagName: string;
  id: string;
  value?: string | number | Record<string, unknown>;
}

export interface EntityChild {
  id: string;
  name: string;
  entityType: EntityType;
  externalId?: string;
  parentId?: string;
  location?: { latitude?: number | null; longitude?: number | null } | null;
}

export interface DestinationsResponse {
  destinations: Array<{ id: string; name: string; slug?: string; parks?: { id: string; name: string }[] }>;
}

export interface EntityData {
  id: string;
  name: string;
  entityType: EntityType;
  parentId?: string | null;
  destinationId?: string | null;
  timezone: string;
  location?: { latitude?: number; longitude?: number } | null;
  tags?: TagData[];
  [k: string]: any;
}

export interface EntityChildrenResponse {
  id: string;
  name: string;
  entityType: EntityType;
  timezone?: string;
  children: EntityChild[];
}

export interface EntityLiveData {
  id: string;
  name: string;
  entityType: EntityType;
  status: LiveStatusType;
  lastUpdated: string;
  queue?: any;
  showtimes?: any[];
  operatingHours?: any[];
  diningAvailability?: any[];
}

export interface EntityLiveDataResponse {
  id: string;
  name: string;
  entityType: EntityType;
  timezone?: string;
  liveData: EntityLiveData[];
}

export interface ScheduleEntry {
  date: string; // YYYY-MM-DD
  openingTime: string; // date-time
  closingTime: string; // date-time
  type: string;
  purchases?: any[];
}

export interface EntityScheduleResponse {
  id: string;
  name: string;
  entityType: EntityType;
  timezone?: string;
  schedule: ScheduleEntry[];
  parks?: EntityScheduleResponse[];
}

export class ThemeParksClient {
  baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl = DEFAULT_BASE, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request(path: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}${path}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fetch error: ${res.status} ${res.statusText} - ${text}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
  }

  async getDestinations(): Promise<DestinationsResponse> {
    return this.request('/destinations');
  }

  async getEntity(entityID: string): Promise<EntityData> {
    if (!entityID) throw new Error('entityID is required');
    return this.request(`/entity/${encodeURIComponent(entityID)}`);
  }

  async getEntityChildren(entityID: string): Promise<EntityChildrenResponse> {
    if (!entityID) throw new Error('entityID is required');
    return this.request(`/entity/${encodeURIComponent(entityID)}/children`);
  }

  async getEntityLiveData(entityID: string): Promise<EntityLiveDataResponse> {
    if (!entityID) throw new Error('entityID is required');
    return this.request(`/entity/${encodeURIComponent(entityID)}/live`);
  }

  async getEntityScheduleUpcoming(entityID: string): Promise<EntityScheduleResponse> {
    if (!entityID) throw new Error('entityID is required');
    return this.request(`/entity/${encodeURIComponent(entityID)}/schedule`);
  }

  async getEntityScheduleYearMonth(entityID: string, year: number, month: number): Promise<EntityScheduleResponse> {
    if (!entityID) throw new Error('entityID is required');
    const mm = String(month).padStart(2, '0');
    return this.request(`/entity/${encodeURIComponent(entityID)}/schedule/${year}/${mm}`);
  }
}

export default ThemeParksClient;
