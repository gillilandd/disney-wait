import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDailyAverages } from '../data/parks';
import { useParkRealtime, fetchMonthlyAverages } from '../services/parks';
import { format } from 'date-fns';

export default function CalendarView() {
  const { id } = useParams();
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const syntheticDays = useMemo(
    () => (id ? getDailyAverages(id, year, month) : []),
    [id, year, month]
  );

  const { park, loading, error } = useParkRealtime(id);

  const [daysState, setDaysState] = useState(syntheticDays);
  const [daysLoading, setDaysLoading] = useState(false);

  useEffect(() => {
    setDaysState(syntheticDays);
    if (!id) return;
    setDaysLoading(true);
    let cancelled = false;
    fetchMonthlyAverages(id, year, month)
      .then((res) => {
        if (!cancelled) setDaysState(res);
      })
      .catch((err) => {
        console.error('Failed to fetch monthly averages from Firestore:', err);
      })
      .finally(() => {
        if (!cancelled) setDaysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, year, month, syntheticDays]);

  if (!id) return <div className="card">Park not found</div>;
  if (loading) return <div className="card">Loading park…</div>;
  if (error)
    return (
      <div className="card">Failed to load park: {String((error as any)?.message ?? error)}</div>
    );
  if (!park) return <div className="card">Park not found</div>;

  function prevMonth() {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    setViewDate(d);
  }
  function nextMonth() {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    setViewDate(d);
  }

  return (
    <div>
      <div className="card">
        <h2>{park.name} — Calendar</h2>
        <div className="small">Month: {format(new Date(year, month, 1), 'MMMM yyyy')}</div>
        {daysLoading && <div className="small">Loading month data…</div>}
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={prevMonth}>
            ◀ Prev
          </button>
          <button style={{ marginLeft: 8 }} className="btn" onClick={nextMonth}>
            Next ▶
          </button>
          <Link style={{ marginLeft: 12 }} className="link" to={`/parks/${park.id}`}>
            Back to park
          </Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        {daysState.map((d) => (
          <div key={d.date} className="calendar-day card">
            <div style={{ fontWeight: 600 }}>{format(new Date(d.date), 'EEE, MMM d')}</div>
            <div className="small">
              Avg wait: <strong>{d.avgWait} min</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
