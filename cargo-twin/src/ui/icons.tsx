import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 16): SVGProps<SVGSVGElement> => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true });

export const IconPlay = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" /></svg>;
export const IconPause = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 5v14M16 5v14" /></svg>;
export const IconStep = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 5l9 7-9 7z" fill="currentColor" stroke="none" /><path d="M18 5v14" /></svg>;
export const IconBack = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M18 5l-9 7 9 7z" fill="currentColor" stroke="none" /><path d="M6 5v14" /></svg>;
export const IconBox = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>;
export const IconPlane = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M21 15.5l-8-4.5V4.8a1.8 1.8 0 10-3.6 0V11l-8 4.5v2l8-2.2v3.4L7 20v1.5l4.2-1 4.2 1V20l-2.4-1.3v-3.4l8 2.2z" /></svg>;
export const IconBars = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const IconShake = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M2 12h3l2-6 4 12 3-9 2 3h6" /></svg>;
export const IconUpload = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" /></svg>;
export const IconDownload = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" /></svg>;
export const IconDice = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>;
export const IconPlus = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconX = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconEye = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const IconExplode = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="9" y="9" width="6" height="6" /><path d="M3 3l4 4M21 3l-4 4M3 21l4-4M21 21l-4-4" /></svg>;
export const IconTarget = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>;
export const IconPrint = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="7" /></svg>;
export const IconKeyboard = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></svg>;
export const IconSpark = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg>;
export const IconAlert = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>;
export const IconCheck = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 12l5 5 9-10" /></svg>;
export const IconInfo = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></svg>;
export const IconStop = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>;
export const IconReset = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8" /><path d="M3 3v5h5" /></svg>;
export const IconTrash = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const IconEdit = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>;
export const IconLayers = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>;

/** Project mark: an abstract contoured container (not an airline logo). */
export const Mark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <defs>
      <linearGradient id="mk" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5fe0c4" />
        <stop offset="1" stopColor="#1d9e82" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="30" height="30" rx="8" fill="#0f2a2a" stroke="#2a5a55" />
    <path d="M9 23h15V9H6v8.5z" fill="url(#mk)" opacity="0.95" />
    <path d="M6 17.5L9 23M11 9v14M16 9v14M21 9v14" stroke="#0f2a2a" strokeWidth="1.2" opacity="0.55" />
  </svg>
);
