'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type DateFilterContextValue = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
};

const DateFilterContext = createContext<DateFilterContextValue | null>(null);

export const DateFilterProvider = ({ children }: { children: ReactNode }) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  return (
    <DateFilterContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateFilterContext.Provider>
  );
};

export const useDateFilter = (): DateFilterContextValue => {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error('useDateFilter must be used within DateFilterProvider');
  return ctx;
};
