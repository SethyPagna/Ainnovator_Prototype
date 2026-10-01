import type { ReactNode } from 'react';

const paths = {
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5" /></>,
  road: <><path d="M2 5h12v12H2z M14 9h4l4 4v4h-8" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  sea: <><path d="M4 12h16l-3 7H7L4 12Z M7 12V5h10v7 M10 5V2 M2 21l3-1 4 1 3-1 4 1 3-1 3 1" /></>,
  air: <path d="m3 15 7-4V5c0-4 4-4 4 0v6l7 4v3l-7-2v4l2 1H8l2-1v-4l-7 2v-3Z" />,
  rail: <><rect x="5" y="3" width="14" height="15" rx="3" /><path d="M5 10h14 M12 3v7 M8 18l-3 4 M16 18l3 4" /><circle cx="8" cy="14" r="1" /><circle cx="16" cy="14" r="1" /></>,
  custom: <path d="M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6" />,
  plus: <path d="M12 5v14 M5 12h14" />,
  arrow: <path d="M4 12h16 M14 6l6 6-6 6" />,
  play: <path d="m8 4 12 8-12 8V4Z" />,
  pause: <path d="M8 4v16 M16 4v16" />,
  download: <path d="M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5" />,
  upload: <path d="M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5" />,
  save: <path d="M4 3h13l4 4v14H3V3h1Z M7 3v6h9V3 M7 21v-8h10v8" />,
  folder: <path d="M3 6V4h7l2 3h9v13H3V6Z" />,
  layers: <path d="m12 3 10 5-10 5L2 8l10-5Z M2 12l10 5 10-5 M2 16l10 5 10-5" />,
  cube: <path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9" />,
  top: <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 12h16 M12 4v16" /></>,
  side: <><rect x="3" y="8" width="18" height="10" rx="1" /><path d="M9 8v10 M15 8v10 M3 21h18" /></>,
  check: <path d="m5 12 4 4L20 5" />,
  warning: <path d="m12 3 10 18H2L12 3Z M12 9v5 M12 17v1" />,
  close: <path d="m6 6 12 12 M6 18 18 6" />,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
  trash: <path d="M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7" />,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
  undo: <path d="M9 5 3 11l6 6 M3 11h11a6 6 0 0 1 0 12" />,
  redo: <path d="m15 5 6 6-6 6 M21 11H10a6 6 0 0 0 0 12" />,
  target: <><circle cx="12" cy="12" r="8" /><path d="M12 2v5 M12 17v5 M2 12h5 M17 12h5" /></>,
  reset: <path d="M3 11a9 9 0 1 1 2 7 M3 3v8h8" />,
  explode: <><rect x="9" y="9" width="6" height="6" /><path d="m3 3 4 4 m14-4-4 4 M3 21l4-4 m14 4-4-4" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  label: <><path d="M3 3h8l10 10-8 8L3 11V3Z" /><circle cx="7" cy="7" r="1" /></>,
  chart: <path d="M4 3v17h17 M8 15v-4 M13 15V6 M18 15v-7" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4 M12 17h.01" /></>,
  search: <><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></>,
  print: <><path d="M6 9V3h12v6 M6 18H3V9h18v9h-3" /><path d="M6 14h12v7H6z" /></>,
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z M20 2v4 M18 4h4" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export const formatNumber = (value: number, digits = 0) => Number.isFinite(value) ? value.toLocaleString('en', { maximumFractionDigits: digits }) : '—';
export const formatPercent = (value: number) => `${formatNumber(value * 100, 1)}%`;
