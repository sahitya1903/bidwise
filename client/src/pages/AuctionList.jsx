import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listAuctions } from '../api/auctions';
import AuctionCard from '../components/AuctionCard';
import Spinner from '../components/Spinner';
import { CATEGORIES } from '../utils/format';

const TABS = [
  { value: 'ACTIVE', label: 'Live now' },
  { value: 'SCHEDULED', label: 'Upcoming' },
  { value: 'ENDED', label: 'Ended' },
];

export default function AuctionList() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const status = params.get('status') || 'ACTIVE';
  const sort = params.get('sort') || 'ending';
  const page = Number(params.get('page')) || 1;

  const [search, setSearch] = useState(q);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => setSearch(q), [q]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    listAuctions({ q: q || undefined, category: category || undefined, status, sort, page })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [q, category, status, sort, page]);

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  return (
    <div className="container page">
      <section className="hero">
        <h1>
          Find something worth <em>bidding</em> on.
        </h1>
        <p className="muted">Live auctions close automatically. The highest bid that meets the reserve wins.</p>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() });
          }}
        >
          <label htmlFor="search" className="sr-only">
            Search auctions
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search cameras, watches, art…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn--primary" type="submit">
            Search
          </button>
        </form>
      </section>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Auction status">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={status === t.value}
              className={`tab${status === t.value ? ' is-active' : ''}`}
              onClick={() => update({ status: t.value === 'ACTIVE' ? '' : t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="toolbar__filters">
          <label className="sr-only" htmlFor="category">
            Category
          </label>
          <select id="category" value={category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="sort">
            Sort
          </label>
          <select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'ending' ? '' : e.target.value })}>
            <option value="ending">Ending soonest</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
      </div>

      {error && <p className="alert alert--error">{error}</p>}
      {!data && !error && <Spinner />}
      {data && (
        <>
          <p className="muted small results-count">
            {data.total} auction{data.total === 1 ? '' : 's'}
            {q && <> matching “{q}”</>}
          </p>
          {data.items.length === 0 ? (
            <div className="empty">
              <p>Nothing here yet.</p>
              {(q || category) && (
                <button className="btn btn--ghost" onClick={() => update({ q: '', category: '' })}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid">
              {data.items.map((a) => (
                <AuctionCard key={a.id} auction={a} />
              ))}
            </div>
          )}
          {data.pages > 1 && (
            <nav className="pagination" aria-label="Pages">
              <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
                ← Previous
              </button>
              <span className="muted small">
                Page {data.page} of {data.pages}
              </span>
              <button
                className="btn btn--ghost btn--sm"
                disabled={page >= data.pages}
                onClick={() => update({ page: page + 1 })}
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
