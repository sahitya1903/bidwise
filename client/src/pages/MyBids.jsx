import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { myBids } from '../api/auctions';
import AuctionCard from '../components/AuctionCard';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { formatINR } from '../utils/format';

const FILTERS = ['ALL', 'WINNING', 'OUTBID', 'WON', 'LOST'];

export default function MyBids() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const load = () => myBids().then(setItems).catch((e) => setError(e.message));
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const shown = items?.filter((r) => filter === 'ALL' || r.bidStatus === filter) ?? [];

  return (
    <div className="container page">
      <h1>My bids</h1>
      {error && <p className="alert alert--error">{error}</p>}
      {!items && !error && <Spinner />}
      {items && items.length === 0 && (
        <div className="empty">
          <p>You have not bid on anything yet.</p>
          <Link to="/" className="btn btn--primary">
            Browse auctions
          </Link>
        </div>
      )}
      {items && items.length > 0 && (
        <>
          <div className="tabs" role="tablist" aria-label="Filter bids">
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={`tab${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                <span className="tab__count">
                  {f === 'ALL' ? items.length : items.filter((r) => r.bidStatus === f).length}
                </span>
              </button>
            ))}
          </div>
          <div className="grid">
            {shown.map((r) => (
              <AuctionCard
                key={r.auction.id}
                auction={r.auction}
                footer={
                  <>
                    <StatusBadge status={r.bidStatus} />
                    <span className="small">
                      Your top bid <strong>{formatINR(r.myHighestBid)}</strong>
                    </span>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
