import React from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { fetchWaitTimesForRide, useParkRealtime } from '../services/parks';
import { WaitTimeEntry } from '../types';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import DateSelector from '../components/DateSelector';

export default function RideHistory() {
  const { parkId, rideId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const [selectedDate, setSelectedDate] = React.useState(
    dateParam ? parseISO(dateParam) : new Date()
  );

  const { park, loading: parkLoading } = useParkRealtime(parkId);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [data, setData] = React.useState<WaitTimeEntry[]>([]);
  const [hover, setHover] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!parkId || !rideId) return;
    setLoading(true);
    setError(null);
    const start = startOfDay(selectedDate);
    // Get the start of the NEXT day to ensure we capture all data for the selected day
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const end = startOfDay(nextDay);
    fetchWaitTimesForRide(parkId, rideId, {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    })
      .then((rows) => setData(rows))
      .catch((e) => setError(e as Error))
      .finally(() => setLoading(false));
  }, [parkId, rideId, selectedDate]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setSearchParams({ date: format(date, 'yyyy-MM-dd') });
  };

  const ride = React.useMemo(
    () => (park?.rides ?? []).find((r: any) => r.id === rideId),
    [park, rideId]
  );

  // Chart calculations
  const points = React.useMemo(() => {
    return data.map((d) => ({
      t: new Date(d.timestamp).getTime(),
      v: d.wait_minutes == null ? null : d.wait_minutes,
    }));
  }, [data]);

  const hasPoints = points.length > 0 && points.some((p) => p.v != null);

  // chart dimensions
  const W = 800;
  const H = 200;
  const pad = { left: 40, right: 20, top: 20, bottom: 36 };

  const xMin = React.useMemo(() => {
    const d = startOfDay(selectedDate);
    return d.getTime();
  }, [selectedDate]);
  const xMax = React.useMemo(() => {
    const d = startOfDay(selectedDate);
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }, [selectedDate]);
  const yVals = React.useMemo(
    () => points.filter((p) => p.v != null).map((p) => p.v as number),
    [points]
  );

  // Calculate average wait time, only counting operating periods (wait_minutes != null and status != 'closed')
  const avgWait = React.useMemo(() => {
    const validEntries = data.filter(
      (entry) => entry.wait_minutes != null && entry.status !== 'closed'
    );
    if (validEntries.length === 0) return 0;
    const sum = validEntries.reduce((acc, entry) => acc + (entry.wait_minutes ?? 0), 0);
    return Math.round(sum / validEntries.length);
  }, [data]);
  // Always show zero as baseline so charts are comparable
  const yMin = 0;
  // Ensure a reasonable top: at least 60, with a small headroom above the max sample
  const yMax = React.useMemo(() => {
    if (yVals.length === 0) return 60;
    const maxV = Math.max(...yVals);
    return Math.max(60, Math.ceil(maxV * 1.1));
  }, [yVals]);

  function xOf(t: number) {
    if (xMax === xMin) return pad.left + (W - pad.left - pad.right) / 2;
    return pad.left + ((t - xMin) / (xMax - xMin)) * (W - pad.left - pad.right);
  }
  function yOf(v: number) {
    if (yMax === yMin) return pad.top + (H - pad.top - pad.bottom) / 2;
    const inv = 1 - (v - yMin) / (yMax - yMin);
    return pad.top + inv * (H - pad.top - pad.bottom);
  }

  const hours = React.useMemo(() => {
    // create hourly ticks between xMin and xMax
    const start = new Date(xMin);
    start.setMinutes(0, 0, 0);
    const out: number[] = [];
    for (let t = start.getTime(); t <= xMax; t += 60 * 60 * 1000) out.push(t);
    return out;
  }, [xMin, xMax]);

  return (
    <div>
      <div className="card">
        <Link className="link" to={`/parks/${parkId}?date=${format(selectedDate, 'yyyy-MM-dd')}`}>
          &larr; Back
        </Link>
        <h2>{ride?.name ?? `Ride ${rideId}`}</h2>
        <DateSelector selectedDate={selectedDate} onDateChange={handleDateChange} />
        <div className="small">Showing wait time history for {format(selectedDate, 'PPP')}</div>
        {!loading && !error && data.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <strong>Average wait time:</strong> {avgWait} min
          </div>
        )}
      </div>

      <div className="card">
        <h3>Wait Time History</h3>
        <div className="chart">
          {loading || parkLoading ? (
            <div className="small">Loading…</div>
          ) : error ? (
            <div className="small">Failed to load: {String(error.message ?? error)}</div>
          ) : !hasPoints ? (
            <div className="no-data">No wait time data for today.</div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Wait times chart">
              {/* horizontal grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                const y = pad.top + t * (H - pad.top - pad.bottom);
                const val = Math.round(yMin + (1 - t) * (yMax - yMin));
                return (
                  <g key={i}>
                    <line className="grid-line" x1={pad.left} x2={W - pad.right} y1={y} y2={y} />
                    <text className="axis-label" x={6} y={y + 4}>
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* vertical hour ticks */}
              {hours.map((t) => (
                <g key={t}>
                  <line
                    className="grid-line"
                    x1={xOf(t)}
                    x2={xOf(t)}
                    y1={pad.top}
                    y2={H - pad.bottom}
                  />
                  <text className="axis-label" x={xOf(t) - 18} y={H - 8}>
                    {format(new Date(t), 'HH:mm')}
                  </text>
                </g>
              ))}

              {/* bars */}
              {points.map((p, i) => {
                const plotWidth = W - pad.left - pad.right;
                // calculate bar width based on number of points. If only one, make it 10px wide.
                const barWidth = points.length > 1 ? (plotWidth / points.length) * 0.8 : 10;
                const x = xOf(p.t) - barWidth / 2;

                if (p.v == null) {
                  // not operational
                  return (
                    <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                      <line
                        x1={xOf(p.t)}
                        x2={xOf(p.t)}
                        y1={pad.top}
                        y2={H - pad.bottom}
                        stroke="#9ca3af"
                        strokeDasharray="2 4"
                      />
                      {hover === i && (
                        <g>
                          <rect
                            x={xOf(p.t) + 8}
                            y={pad.top + 8}
                            width={100}
                            height={28}
                            rx={6}
                            fill="#111"
                            opacity={0.9}
                          />
                          <text
                            x={xOf(p.t) + 16}
                            y={pad.top + 26}
                            fill="#fff"
                            fontSize={12}
                          >{`${format(new Date(p.t), 'HH:mm')} • Closed`}</text>
                        </g>
                      )}
                    </g>
                  );
                }

                const y = yOf(p.v);
                const barHeight = H - pad.bottom - y;

                return (
                  <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill={hover === i ? '#0f766e' : '#0ea5a4'}
                      rx={1}
                    />
                    {hover === i && (
                      <g>
                        <rect
                          x={xOf(p.t) + 8}
                          y={y - 28}
                          width={100}
                          height={28}
                          rx={6}
                          fill="#111"
                          opacity={0.9}
                        />
                        <text
                          x={xOf(p.t) + 16}
                          y={y - 10}
                          fill="#fff"
                          fontSize={12}
                        >{`${format(new Date(p.t), 'HH:mm')} • ${p.v} min`}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <h4>Polled Wait Times</h4>
          {data.length === 0 ? (
            <div className="small">No entries</div>
          ) : (
            <div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Wait</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.timestamp}>
                      <td>{format(new Date(d.timestamp), 'Pp')}</td>
                      <td>{d.wait_minutes == null ? 'n/a' : `${d.wait_minutes} min`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
