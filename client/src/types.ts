export interface WaitTimeEntry {
  wait_minutes: number | null;
  timestamp: string; // ISO
  status?: string | null;
  source?: string | null;
  [k: string]: any;
}

export interface Ride {
  id: string;
  name: string;
  wait_times: WaitTimeEntry[];
}

export interface Park {
  id: string;
  name: string;
  location?: string;
  rides: Ride[];
}

export interface DayAverage {
  date: string; // ISO
  avgWait: number;
}
