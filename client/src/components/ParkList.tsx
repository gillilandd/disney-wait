import React from 'react'
import ParkCard from './ParkCard'
import { useParksRealtime } from '../services/parks'

export default function ParkList() {
  const { parks, loading, error } = useParksRealtime()
  if (loading) return <div className="card">Loading parks…</div>
  if (error) return <div className="card">Failed to load parks: {String((error as any)?.message ?? error)}</div>

  return (
    <div>
      <div className="card">
        <h2>Theme Parks</h2>
        <p className="small">Select a park to see today's summary and a calendar view of average wait times.</p>
      </div>

      <div className="park-list">
        {parks.map(p => (
          <ParkCard key={p.id} park={p} />
        ))}
      </div>
    </div>
  )
}
