import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ParkList from './components/ParkList';
import ParkDetails from './pages/ParkDetails';
import CalendarView from './pages/CalendarView';
import RideHistory from './pages/RideHistory';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          🎢 Disney Crowd Tracker
        </Link>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<ParkList />} />
          <Route path="/parks/:id" element={<ParkDetails />} />
          <Route path="/parks/:parkId/rides/:rideId" element={<RideHistory />} />
          <Route path="/parks/:id/calendar" element={<CalendarView />} />
        </Routes>
      </main>
      <footer className="footer"></footer>
    </div>
  );
}
