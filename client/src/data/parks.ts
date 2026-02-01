import { DayAverage, WaitTimeEntry } from '../types';
import { formatISO, startOfMonth, endOfMonth, addDays } from 'date-fns';

// Sample data removed. Parks should be read from Firestore via `src/services/parks.ts`.
// Keep helper functions for computing averages locally based on the in-memory `Park` model.

export function getParks(): never[] {
  throw new Error(
    'getParks() sample data removed. Use src/services/parks.fetchParks() or useParksRealtime().'
  );
}

// Deterministic pseudo-random generator (for demo data) based on seed
function seeded(num: number) {
  const x = Math.sin(num) * 10000;
  return x - Math.floor(x);
}

export function getDailyAverages(parkId: string, year: number, monthIndex: number): DayAverage[] {
  // monthIndex: 0 = Jan
  const start = startOfMonth(new Date(year, monthIndex, 1));
  const end = endOfMonth(start);
  const days: DayAverage[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const seed = `${parkId}-${formatISO(d, { representation: 'date' })}`;
    // transform seed string to number
    let s = 0;
    for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i) * (i + 1);
    const base = Math.floor(seeded(s) * 60); // 0-59
    const variation = Math.floor(seeded(s + 7) * 20) - 10; // -10..+9
    const avg = Math.max(0, Math.round(base + variation));
    days.push({ date: formatISO(d, { representation: 'date' }), avgWait: avg });
  }
  return days;
}

function latestWaitForRide(ride: { wait_times?: WaitTimeEntry[] }) {
  const times = ride.wait_times ?? [];
  if (times.length === 0) return null;
  return times.reduce(
    (best: WaitTimeEntry | null, cur) => (!best || cur.timestamp > best.timestamp ? cur : best),
    null
  );
}

export function computeNowAveragesFromPark(park: { rides?: any[] } | null) {
  if (!park) return { open: 0, total: 0, avgWait: 0 };
  const total = (park.rides ?? []).length;
  const waits = (park.rides ?? [])
    .map((r) => latestWaitForRide(r as any))
    .filter((w): w is WaitTimeEntry => !!w && w.wait_minutes != null);
  const openCount = waits.length;
  const avgWait =
    openCount === 0
      ? 0
      : Math.round(waits.reduce((s, w) => s + (w.wait_minutes ?? 0), 0) / openCount);
  return { open: openCount, total, avgWait };
}
