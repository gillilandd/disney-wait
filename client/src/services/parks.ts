// src/services/parks.ts
// Utilities to read parks from Firestore
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  doc,
  getDoc,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Park, Ride, WaitTimeEntry, DayAverage } from '../types';
import { useEffect, useState } from 'react';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, formatISO, addDays } from 'date-fns';

async function fetchLatestWaitForRide(
  parkId: string,
  rideId: string
): Promise<WaitTimeEntry | null> {
  try {
    const q = query(
      collection(db, 'parks', parkId, 'rides', rideId, 'wait_times'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.docs.length === 0) return null;
    return snap.docs[0].data() as WaitTimeEntry;
  } catch (e) {
    console.error('Error fetching latest wait_time for', parkId, rideId, e);
    return null;
  }
}

export async function fetchWaitTimesForRide(
  parkId: string,
  rideId: string,
  opts?: { startIso?: string; endIso?: string }
): Promise<WaitTimeEntry[]> {
  try {
    let q = collection(db, 'parks', parkId, 'rides', rideId, 'wait_times') as any;
    if (opts?.startIso || opts?.endIso) {
      const clauses: any[] = [];
      if (opts.startIso) clauses.push(where('timestamp', '>=', opts.startIso));
      if (opts.endIso) clauses.push(where('timestamp', '<=', opts.endIso));
      q = query(
        collection(db, 'parks', parkId, 'rides', rideId, 'wait_times'),
        ...clauses,
        orderBy('timestamp', 'asc')
      );
    } else {
      // default: return all records
      q = query(
        collection(db, 'parks', parkId, 'rides', rideId, 'wait_times'),
        orderBy('timestamp', 'asc')
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => d.data() as WaitTimeEntry);
  } catch (e) {
    console.error('Error fetching wait_times for', parkId, rideId, opts, e);
    return [];
  }
}

export async function fetchRidesForPark(
  parkId: string,
  opts?: { waitTimes?: 'latest' | 'today' | 'month'; year?: number; month?: number }
): Promise<Ride[]> {
  // fetch rides subcollection
  const snap = await getDocs(collection(db, 'parks', parkId, 'rides'));
  const rides: Ride[] = await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as Partial<Ride>;
      let wait_times: WaitTimeEntry[] = [];

      if (opts?.waitTimes === 'latest') {
        const latest = await fetchLatestWaitForRide(parkId, d.id);
        if (latest) wait_times = [latest];
      } else if (opts?.waitTimes === 'month' && opts.year != null && opts.month != null) {
        const start = formatISO(startOfMonth(new Date(opts.year, opts.month, 1)));
        const end = formatISO(endOfMonth(new Date(opts.year, opts.month, 1)));
        wait_times = await fetchWaitTimesForRide(parkId, d.id, { startIso: start, endIso: end });
      } else {
        // default: today
        wait_times = await fetchWaitTimesForRide(parkId, d.id);
      }

      // If ride document had inline wait_times, and opts didn't request specific range, use inline
      if (
        (data.wait_times as WaitTimeEntry[] | undefined) &&
        (!opts || opts.waitTimes !== 'month')
      ) {
        wait_times = data.wait_times as WaitTimeEntry[];
      }

      return { id: d.id, name: data.name ?? d.id, wait_times };
    })
  );
  return rides;
}

export async function fetchParkById(parkId: string): Promise<Park | null> {
  const d = await getDoc(doc(db, 'parks', parkId));
  if (!d.exists()) return null;
  const data = d.data() as any;
  const park: Park = {
    id: d.id,
    name: data.name ?? 'Unknown park',
    location: data.location ?? '',
    rides: (data.rides ?? []) as any[],
  };
  if ((park.rides?.length ?? 0) === 0) {
    try {
      const r = await fetchRidesForPark(parkId, { waitTimes: 'latest' });
      if (r.length > 0) return { ...park, rides: r };
    } catch (e) {
      console.error('Failed to fetch rides subcollection for park', parkId, e);
    }
  }
  return park;
}

export async function fetchParks(): Promise<Park[]> {
  const snap = await getDocs(collection(db, 'parks'));
  const parks = snap.docs.map((d) => {
    const data = d.data() as Partial<Omit<Park, 'id'>>;
    return {
      id: d.id,
      name: data.name ?? 'Unknown park',
      location: data.location ?? '',
      rides: (data.rides ?? []) as any[],
    };
  });

  // If some parks have no inline `rides`, try loading from subcollections
  const parksWithRides = await Promise.all(
    parks.map(async (p) => {
      if ((p.rides?.length ?? 0) > 0) return p;
      try {
        const r = await fetchRidesForPark(p.id);
        if (r.length > 0) {
          console.log(`Loaded ${r.length} rides from subcollection for park ${p.id}`);
          return { ...p, rides: r };
        }
      } catch (e) {
        console.error('Failed to fetch subcollection rides for', p.id, e);
      }
      return p;
    })
  );

  return parksWithRides;
}

export async function fetchMonthlyAverages(
  parkId: string,
  year: number,
  monthIndex: number
): Promise<DayAverage[]> {
  // Fetch all rides with wait times for the month
  const rides = await fetchRidesForPark(parkId, { waitTimes: 'month', year, month: monthIndex });

  const start = startOfMonth(new Date(year, monthIndex, 1));
  const end = endOfMonth(start);
  const daysMap: Record<string, number[]> = {};

  rides.forEach((r) => {
    (r.wait_times ?? []).forEach((w) => {
      if (w.wait_minutes == null) return;
      const date = formatISO(new Date(w.timestamp), { representation: 'date' });
      daysMap[date] = daysMap[date] || [];
      daysMap[date].push(w.wait_minutes);
    });
  });

  const days: DayAverage[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key = formatISO(d, { representation: 'date' });
    const arr = daysMap[key] ?? [];
    const avg = arr.length === 0 ? 0 : Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
    days.push({ date: key, avgWait: avg });
  }
  return days;
}

export function useParkRealtime(parkId?: string) {
  const [park, setPark] = useState<Park | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!parkId) {
      setPark(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const docRef = doc(db, 'parks', parkId);
    const unsub = onSnapshot(
      docRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          setPark(null);
          setLoading(false);
          return;
        }
        const data = snapshot.data() as any;
        let p: Park = {
          id: snapshot.id,
          name: data.name ?? 'Unknown park',
          location: data.location ?? '',
          rides: (data.rides ?? []) as any[],
        };
        // if no rides inline, fetch subcollection
        if ((p.rides?.length ?? 0) === 0) {
          try {
            const r = await fetchRidesForPark(parkId);
            if (r.length > 0) p = { ...p, rides: r };
          } catch (e) {
            console.error('Failed to fetch rides for park in realtime hook', parkId, e);
          }
        }
        setPark(p);
        setLoading(false);
      },
      (err) => {
        console.error('useParkRealtime onSnapshot error', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [parkId]);

  return { park, loading, error };
}

export function useParksRealtime() {
  const [parks, setParks] = useState<Park[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'parks'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const baseParks = snapshot.docs.map((d) => {
          const data = d.data() as Partial<Omit<Park, 'id'>>;
          return {
            id: d.id,
            name: data.name ?? 'Unknown park',
            location: data.location ?? '',
            rides: (data.rides ?? []) as any[],
          };
        });

        setParks(baseParks);
        setLoading(false);

        // For parks with missing/empty rides, try loading them from a subcollection
        (async () => {
          try {
            const updated = await Promise.all(
              baseParks.map(async (p) => {
                if ((p.rides?.length ?? 0) > 0) return p;
                try {
                  // For lists, fetch only the latest entry per ride to compute open/closed and current wait
                  const r = await fetchRidesForPark(p.id, { waitTimes: 'latest' });
                  if (r.length > 0) {
                    console.log(
                      `Loaded ${r.length} rides from subcollection for park ${p.id} (realtime with latest waits)`
                    );
                    return { ...p, rides: r };
                  }
                } catch (e) {
                  console.error('Failed to fetch subcollection rides for', p.id, e);
                }
                return p;
              })
            );
            // If any were updated, replace the parks state
            setParks(updated);
          } catch (e) {
            console.error('Error while fetching subcollection rides:', e);
          }
        })();
      },
      (err) => {
        // Log the error to the console to help debugging (permission, network, etc.)
        console.error('Firestore onSnapshot error:', err);
        setError(err as Error);
        setLoading(false);

        // Try a one-time fetch as a fallback so we can see if reads work without realtime
        (async () => {
          try {
            const snap = await getDocs(collection(db, 'parks'));
            const fallback = snap.docs.map((d) => {
              const data = d.data() as Partial<Omit<Park, 'id'>>;
              return {
                id: d.id,
                name: data.name ?? 'Unknown park',
                location: data.location ?? '',
                rides: (data.rides ?? []) as any[],
              };
            });
            setParks(fallback);
          } catch (e) {
            console.error('Fallback getDocs failed:', e);
          }
        })();
      }
    );
    return () => unsub();
  }, []);

  return { parks, loading, error };
}
