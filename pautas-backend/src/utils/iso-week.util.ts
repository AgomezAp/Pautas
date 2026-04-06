import { getISOWeek, getISOWeekYear, startOfISOWeek, endOfISOWeek, format } from 'date-fns';

export function getISOWeekInfo(date: Date) {
  return {
    isoWeek: getISOWeek(date),
    isoYear: getISOWeekYear(date),
  };
}

export function getWeekRange(date: Date) {
  return {
    start: startOfISOWeek(date),
    end: endOfISOWeek(date),
  };
}

export function getWeekRangeFromISOWeek(isoYear: number, isoWeek: number) {
  // Create a date in the given ISO week
  const jan4 = new Date(isoYear, 0, 4);
  const start = startOfISOWeek(jan4);
  // Add the required number of weeks
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() + (isoWeek - 1) * 7);
  const weekEnd = endOfISOWeek(weekStart);
  return { start: weekStart, end: weekEnd };
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
