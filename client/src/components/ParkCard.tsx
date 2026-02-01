import React from 'react';
import { Link } from 'react-router-dom';
import { Park } from '../types';

function latestWait(ride: any) {
  const times = ride.wait_times ?? [];
  if (times.length === 0) return undefined;
  return times.reduce(
    (best: any, cur: any) => (best == null || cur.timestamp > best.timestamp ? cur : best),
    undefined
  );
}

export default function ParkCard({ park }: { park: Park }) {
  const rides = (park as any).rides ?? [];
  const total = rides.length;
  const open = rides.filter((r: any) => {
    const l = latestWait(r);
    return l && l.wait_minutes != null && l.status !== 'closed';
  }).length;

  return (
    <div className="park-card card">
      <h3>{park.name}</h3>
      <div className="small">{(park as any).location}</div>
      <div style={{ marginTop: 8 }}>
        <strong>{open}</strong> open of <strong>{total}</strong> rides
      </div>
      <div style={{ marginTop: 8 }}>
        <Link className="link" to={`/parks/${park.id}`}>
          View details →
        </Link>
      </div>
    </div>
  );
}
