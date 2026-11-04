import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { myListings } from '../api/auctions';
import AuctionCard from '../components/AuctionCard';
import Spinner from '../components/Spinner';
import { formatINR } from '../utils/format';

function result(a) {
  switch (a.status) {
    case 'SOLD':
      return `Sold to ${a.winner?.name || 'winner'} for ${formatINR(a.finalPrice)}`;
    case 'UNSOLD':
      return a.bidCount > 0 ? 'Ended — reserve not met' : 'Ended — no bids';
    case 'CANCELLED':
      return 'Cancelled';
    case 'SCHEDULED':
      return 'Not started yet';
    default:
      return a.bidCount > 0 ? `Leading: ${a.highestBidder?.name}` : 'No bids yet';
  }
}

export default function MyListings() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    myListings().then(setItems).catch((e) => setError(e.message));
  }, []);

  const sold = items?.filter((a) => a.status === 'SOLD') ?? [];
  const revenue = sold.reduce((sum, a) => sum + a.finalPrice, 0);

  return (
    <div className="container page">
      <div className="page-head">
        <h1>My listings</h1>
        <Link to="/sell" className="btn btn--primary">
          + New auction
        </Link>
      </div>
      {error && <p className="alert alert--error">{error}</p>}
      {!items && !error && <Spinner />}
      {items && items.length > 0 && (
        <dl className="stats">
          <div>
            <dt>Listings</dt>
            <dd>{items.length}</dd>
          </div>
          <div>
            <dt>Live</dt>
            <dd>{items.filter((a) => a.status === 'ACTIVE').length}</dd>
          </div>
          <div>
            <dt>Sold</dt>
            <dd>{sold.length}</dd>
          </div>
          <div>
            <dt>Earned</dt>
            <dd>{formatINR(revenue)}</dd>
          </div>
        </dl>
      )}
      {items && items.length === 0 && (
        <div className="empty">
          <p>You have not listed anything yet.</p>
          <Link to="/sell" className="btn btn--primary">
            Sell an item
          </Link>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="grid">
          {items.map((a) => (
            <AuctionCard key={a.id} auction={a} footer={<span className="small">{result(a)}</span>} />
          ))}
        </div>
      )}
    </div>
  );
}
