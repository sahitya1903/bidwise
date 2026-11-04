import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { cancelAuction, getAuction, getBids, placeBid } from '../api/auctions';
import { useAuth } from '../context/AuthContext';
import AuctionImage from '../components/AuctionImage';
import BidForm from '../components/BidForm';
import BidHistory from '../components/BidHistory';
import Countdown from '../components/Countdown';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, formatINR } from '../utils/format';

const POLL_MS = 3000; // FR-11

export default function AuctionDetail() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [flash, setFlash] = useState(false);
  const lastBidCount = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([getAuction(id), getBids(id)]);
      if (lastBidCount.current !== null && a.bidCount !== lastBidCount.current) {
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      }
      lastBidCount.current = a.bidCount;
      setAuction(a);
      setBids(b);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  // Poll every 3 s so other viewers' bids and the final result show up without a reload.
  useEffect(() => {
    lastBidCount.current = null;
    setAuction(null);
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!auction) {
    return <div className="container page">{error ? <p className="alert alert--error">{error}</p> : <Spinner />}</div>;
  }

  const a = auction;
  const isSeller = user && a.seller?.id === user.id;
  const isLeader = user && a.highestBidder?.id === user.id;
  const isOpen = a.status === 'ACTIVE' && a.timeLeftMs > 0;
  const awaitingClose = a.status === 'ACTIVE' && a.timeLeftMs <= 0;
  const canEdit = isSeller && a.bidCount === 0 && (a.status === 'ACTIVE' || a.status === 'SCHEDULED');
  const canCancel =
    (a.status === 'ACTIVE' || a.status === 'SCHEDULED') && (isAdmin || (isSeller && a.bidCount === 0));

  async function handleBid(amount) {
    setNotice('');
    let result;
    try {
      result = await placeBid(a.id, amount);
    } catch (e) {
      refresh(); // show the new minimum if someone else bid first
      throw e;
    }
    setNotice(`Bid of ${formatINR(amount)} placed. You are the highest bidder.`);
    lastBidCount.current = result.auction.bidCount;
    setAuction(result.auction);
    setBids(await getBids(a.id));
  }

  async function handleCancel() {
    if (!window.confirm('Cancel this auction? This cannot be undone.')) return;
    try {
      setAuction(await cancelAuction(a.id));
      setNotice('Auction cancelled.');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="container page">
      <Link to="/" className="back-link">
        ← All auctions
      </Link>
      <div className="detail">
        <div className="detail__media">
          <AuctionImage src={a.imageUrl} title={a.title} category={a.category} className="detail__image" />
        </div>

        <div className="detail__main">
          <p className="eyebrow">
            {a.category} · Sold by {a.seller?.name}
          </p>
          <h1 className="detail__title">{a.title}</h1>
          <div className="detail__status">
            <StatusBadge status={a.status} />
            {(a.status === 'ACTIVE' || a.status === 'SCHEDULED') && (
              <Countdown endTime={a.endTime} startTime={a.startTime} status={a.status} />
            )}
          </div>

          <section className={`panel price-panel${flash ? ' is-flash' : ''}`} aria-live="polite">
            {a.status === 'SOLD' ? (
              <>
                <span className="label">Sold to {a.winner?.name || 'the winner'} for</span>
                <strong className="price price--big">{formatINR(a.finalPrice)}</strong>
              </>
            ) : (
              <>
                <span className="label">{a.bidCount > 0 ? 'Current bid' : 'Starting price'}</span>
                <strong className="price price--big">{formatINR(a.bidCount > 0 ? a.currentBid : a.startingPrice)}</strong>
              </>
            )}
            <dl className="facts">
              <div>
                <dt>Bids</dt>
                <dd>{a.bidCount}</dd>
              </div>
              <div>
                <dt>Increment</dt>
                <dd>{formatINR(a.minIncrement)}</dd>
              </div>
              <div>
                <dt>Reserve</dt>
                <dd>
                  {!a.hasReserve ? 'None' : a.reserveMet ? 'Met' : 'Not met yet'}
                  {a.reservePrice !== undefined && a.hasReserve && (
                    <span className="muted small"> ({formatINR(a.reservePrice)})</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>{a.status === 'SCHEDULED' ? 'Starts' : 'Ends'}</dt>
                <dd>{formatDateTime(a.status === 'SCHEDULED' ? a.startTime : a.endTime)}</dd>
              </div>
            </dl>
          </section>

          {notice && (
            <p className="alert alert--success" role="status">
              {notice}
            </p>
          )}
          {error && <p className="alert alert--error">{error}</p>}

          {isOpen && (
            <section className="panel">
              {!user && (
                <div className="login-prompt">
                  <p>Log in to place a bid.</p>
                  <button
                    className="btn btn--primary"
                    onClick={() => navigate('/login', { state: { from: location } })}
                  >
                    Log in to bid
                  </button>
                </div>
              )}
              {user && isSeller && <p className="muted">This is your auction, so you cannot bid on it.</p>}
              {user && !isSeller && isLeader && (
                <p className="alert alert--success">You are the highest bidder. We will show it here if you are outbid.</p>
              )}
              {user && !isSeller && !isLeader && (
                <BidForm minNextBid={a.minNextBid} increment={a.minIncrement} onSubmit={handleBid} />
              )}
            </section>
          )}
          {awaitingClose && <p className="alert">Bidding has ended. The result will appear in a few seconds…</p>}
          {a.status === 'UNSOLD' && (
            <p className="alert">This auction ended without a sale{a.bidCount > 0 ? ' (reserve not met)' : ''}.</p>
          )}
          {a.status === 'SOLD' && user && a.winner?.id === user.id && (
            <p className="alert alert--success">You won this auction!</p>
          )}
          {a.status === 'SCHEDULED' && <p className="alert">Bidding opens {formatDateTime(a.startTime)}.</p>}

          {(canEdit || canCancel) && (
            <div className="actions">
              {canEdit && (
                <Link to={`/auctions/${a.id}/edit`} className="btn btn--ghost">
                  Edit auction
                </Link>
              )}
              {canCancel && (
                <button className="btn btn--danger" onClick={handleCancel}>
                  {isAdmin && !isSeller ? 'Cancel (admin)' : 'Cancel auction'}
                </button>
              )}
            </div>
          )}

          {a.description && (
            <section className="description">
              <h2>About this item</h2>
              <p>{a.description}</p>
            </section>
          )}
        </div>

        <aside className="detail__history">
          <h2>Bid history</h2>
          <BidHistory bids={bids} currentUserId={user?.id} />
        </aside>
      </div>
    </div>
  );
}
