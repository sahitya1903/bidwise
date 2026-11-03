import { formatDateTime, formatINR } from '../utils/format';

export default function BidHistory({ bids, currentUserId }) {
  if (!bids?.length) return <p className="muted">No bids yet. Be the first.</p>;
  return (
    <ol className="bid-history">
      {bids.map((b, i) => (
        <li key={b.id} className={i === 0 ? 'is-top' : ''}>
          <span className="bid-history__who">
            {b.bidder?.name || 'Unknown'}
            {b.bidder?.id === currentUserId && <span className="you">you</span>}
          </span>
          <span className="bid-history__amount">{formatINR(b.amount)}</span>
          <span className="bid-history__when">{formatDateTime(b.createdAt)}</span>
        </li>
      ))}
    </ol>
  );
}
