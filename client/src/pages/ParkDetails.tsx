import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { computeNowAveragesFromPark } from '../data/parks';
import { useParkRealtime, fetchDayAverageForRide } from '../services/parks';
import { format, isToday } from 'date-fns';
import DateSelector from '../components/DateSelector';
import { Ride } from '../types';

function latestWaitForRide(ride: any) {
  const times = ride.wait_times ?? [];
  if (times.length === 0) return null;
  return times.reduce(
    (best: any, cur: any) => (!best || cur.timestamp > best.timestamp ? cur : best),
    null
  );
}

export default function ParkDetails() {
  const { id } = useParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { park, loading, error } = useParkRealtime(id, selectedDate);
  const [dayAverages, setDayAverages] = useState<Record<string, number>>({});

  // Filter state and derived lists (hooks must be called unconditionally)
  const [filter, setFilter] = React.useState('');

  useEffect(() => {
    if (park && !isToday(selectedDate)) {
      const calculateAverages = async () => {
        const averages: Record<string, number> = {};
        for (const ride of park.rides as Ride[]) {
          const avg = await fetchDayAverageForRide(park.id, ride.id, selectedDate);
          averages[ride.id] = avg;
        }
        setDayAverages(averages);
      };
      calculateAverages();
    } else {
      setDayAverages({});
    }
  }, [park, selectedDate]);

  const allRidesSorted = React.useMemo(() => {
    const ridesWithMeta = (park?.rides ?? []).map((r: any) => {
      const l = latestWaitForRide(r);
      const wait = !isToday(selectedDate) ? dayAverages[r.id] : l?.wait_minutes ?? null;
      const isClosed = !isToday(selectedDate) ? wait === 0 : !l || l.wait_minutes == null || l.status === 'closed';
      const ts = l?.timestamp ?? null;
      return { ...r, latest: l, wait, isClosed, ts };
    });
    return ridesWithMeta.sort((a: any, b: any) => {
      if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
      if (!a.isClosed && !b.isClosed) return (b.wait ?? 0) - (a.wait ?? 0);
      if (a.ts && b.ts) return b.ts.localeCompare(a.ts);
      return 0;
    });
  }, [park, selectedDate, dayAverages]);

  const filteredRides = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allRidesSorted;
    return allRidesSorted.filter((r: any) => (r.name ?? '').toLowerCase().includes(q));
  }, [filter, allRidesSorted]);

  if (!id) return <div className="card">Park not found</div>;
  if (loading) return <div className="card">Loading park…</div>;
  if (error)
    return (
      <div className="card">Failed to load park: {String((error as any)?.message ?? error)}</div>
    );
  if (!park) return <div className="card">Park not found</div>;

  const now = computeNowAveragesFromPark(park);

  return (
    <div>
      <div className="card">
        <h2>{park.name}</h2>
        <div className="small">{park.location}</div>
        <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        <div style={{ marginTop: 12 }}>
          {!isToday(selectedDate) && (
            <div style={{ marginBottom: 8, fontStyle: 'italic' }}>
              Showing average wait times for {format(selectedDate, 'PPP')}.
            </div>
          )}
          <div>
            <strong>Selected date:</strong> {format(selectedDate, 'PPP')}
          </div>
          {isToday(selectedDate) && (
            <>
              <div style={{ marginTop: 8 }}>
                <strong>Rides open:</strong> {now.open} / {now.total}
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>Average wait right now:</strong> {now.avgWait} min
              </div>
            </>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <Link className="btn" to={`/parks/${park.id}/calendar`}>
            Open calendar
          </Link>
          <Link style={{ marginLeft: 12 }} className="link" to="/">
            Back to parks
          </Link>
        </div>
      </div>

      <div className="card">
        <h3>Rides</h3>
        {/* Filter input */}
        <div className="filter-row">
          <input
            className="filter-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rides by name..."
            aria-label="Filter rides"
          />
          <div className="filter-count">
            {filteredRides.length} / {allRidesSorted.length}
          </div>
        </div>

        <div className="ride-list">
          {filteredRides.map((r: any) => {
            const ts = r.ts ? ` • ${format(new Date(r.ts), 'Pp')}` : '';

            // determine badge color
            const wait = r.wait as number | null;
            const badgeClass =
              wait == null
                ? 'red'
                : wait <= 15
                  ? 'green'
                  : wait <= 30
                    ? 'yellow'
                    : wait <= 50
                      ? 'orange'
                      : 'red';

            return (
              <div key={r.id} className={`ride-row ${r.isClosed ? 'closed' : ''}`}>
                <Link
                  to={`/parks/${park.id}/rides/${r.id}?date=${format(selectedDate, 'yyyy-MM-dd')}`}
                  className="ride-link"
                >
                  <div>
                    <div className="ride-name">
                      <span className="status-icon" aria-hidden>
                        {r.isClosed ? (
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="#9CA3AF"
                              strokeWidth="1.5"
                              fill="#F3F4F6"
                            />
                            <path
                              d="M8 8l8 8M16 8l-8 8"
                              stroke="#9CA3AF"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" fill="#10B981" />
                            <path
                              d="M9 12.5l1.8 1.8L15 10"
                              stroke="#fff"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      {r.name}
                    </div>
                    <div className="ride-meta">
                      {isToday(selectedDate)
                        ? r.isClosed
                          ? 'Closed'
                          : `Updated${ts}`
                        : 'Avg Wait'}
                    </div>
                  </div>
                </Link>
                <div>
                  {r.isClosed ? (
                    <span className="ride-closed">Closed</span>
                  ) : (
                    <div className={`wait-badge ${badgeClass}`}>{r.wait} min</div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredRides.length === 0 && <div className="small">No rides match your filter.</div>}
        </div>
      </div>
    </div>
  );
}
