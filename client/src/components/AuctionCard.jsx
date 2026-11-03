import { Link } from 'react-router-dom';
import AuctionImage from './AuctionImage';
import Countdown from './Countdown';
import StatusBadge from './StatusBadge';
import { formatINR } from '../utils/format';

export default function AuctionCard({ auction, footer }) {
  const a = auction;
  const open = a.status === 'ACTIVE' || a.status === 'SCHEDULED';
  const price = a.status === 'SOLD' ? a.finalPrice : a.bidCount > 0 ? a.currentBid : a.startingPrice;
  const priceLabel = a.status === 'SOLD' ? 'Sold for' : a.bidCount > 0 ? 'Current bid' : 'Starting at';

  return (
    <article className="card auction-card">
      <Link to={`/auctions/${a.id}`} className="auction-card__link">
        <div className="auction-card__media">
          <AuctionImage src={a.imageUrl} title={a.title} category={a.category} />
          <StatusBadge status={a.status} />
        </div>
        <div className="auction-card__body">
          <p className="eyebrow">{a.category}</p>
          <h3 className="auction-card__title">{a.title}</h3>
          <div className="auction-card__meta">
            <div>
              <span className="label">{priceLabel}</span>
              <strong className="price">{formatINR(price)}</strong>
            </div>
            <div className="auction-card__right">
              <span className="label">
                {a.bidCount} bid{a.bidCount === 1 ? '' : 's'}
              </span>
              {open ? (
                <Countdown endTime={a.endTime} startTime={a.startTime} status={a.status} compact />
              ) : (
                <span className="muted small">Closed</span>
              )}
            </div>
          </div>
        </div>
      </Link>
      {footer && <div className="auction-card__footer">{footer}</div>}
    </article>
  );
}
