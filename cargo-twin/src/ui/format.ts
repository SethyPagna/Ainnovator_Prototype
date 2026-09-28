export const kg = (v: number) => `${Math.round(v).toLocaleString('en-US')} kg`;
export const tonnes = (v: number, d = 1) => `${(v / 1000).toFixed(d)} t`;
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
export const num = (v: number, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const m3 = (v: number) => `${v.toFixed(1)} m³`;
export const dims = (l: number, w: number, h: number) => `${l}×${w}×${h} cm`;
export const shortUld = (id: string) => id.replace(/ XX$/, '');
