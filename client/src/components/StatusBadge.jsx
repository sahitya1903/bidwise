const LABELS = {
  ACTIVE: 'Live',
  SCHEDULED: 'Scheduled',
  SOLD: 'Sold',
  UNSOLD: 'Unsold',
  CANCELLED: 'Cancelled',
  WINNING: 'Winning',
  OUTBID: 'Outbid',
  WON: 'Won',
  LOST: 'Lost',
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge--${status.toLowerCase()}`}>{LABELS[status] || status}</span>;
}
