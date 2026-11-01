// Money arrives from the API as integer paise. Convert only for display and input.

export function formatINR(paise) {
  if (paise == null) return '—';
  const hasFraction = paise % 100 !== 0;
  return (
    '₹' +
    (paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

// "1,099.99" → 109999. Returns NaN for anything that is not a number.
export function rupeesToPaise(input) {
  const cleaned = String(input ?? '').replace(/[,\s₹]/g, '');
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}

export function paiseToRupeesInput(paise) {
  if (!paise) return '';
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

// 93784000 → "1d 2h 3m"; under an hour shows seconds.
export function formatDuration(ms) {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${String(sec).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Date → "2026-11-04T15:30" for <input type="datetime-local"> in local time.
export function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const CATEGORIES = [
  'Electronics',
  'Collectibles',
  'Fashion',
  'Home',
  'Art',
  'Books',
  'Sports',
  'Vehicles',
  'Other',
];
