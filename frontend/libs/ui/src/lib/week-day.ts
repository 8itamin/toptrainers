export interface WeekDay {
  isoDate: string;
  shortLabel: string;
  dateLabel: string;
  state: 'idle' | 'today' | 'done';
}
