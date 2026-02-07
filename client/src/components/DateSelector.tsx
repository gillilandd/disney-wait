import React from 'react';
import { isToday } from 'date-fns';

interface DateSelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const DateSelector: React.FC<DateSelectorProps> = ({ selectedDate, onDateChange }) => {
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
      <button onClick={handlePrevDay}>&lt;</button>
      <h3 style={{ margin: '0 15px' }}>{selectedDate.toDateString()}</h3>
      <button onClick={handleNextDay} disabled={isToday(selectedDate)}>&gt;</button>
    </div>
  );
};

export default DateSelector;
