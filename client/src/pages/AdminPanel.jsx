import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listUsers } from '../api/auth';
import { cancelAuction, listAuctions } from '../api/auctions';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, formatINR } from '../utils/format';

export default function AdminPanel() {
  const [users, setUsers] = useState(null);
  const [auctions, setAuctions] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [u, active, scheduled] = await Promise.all([
        listUsers(),
        listAuctions({ status: 'ACTIVE', limit: 50 }),
        listAuctions({ status: 'SCHEDULED', limit: 50 }),
      ]);
      setUsers(u);
      setAuctions([...active.items, ...scheduled.items]);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(a) {
    if (!window.confirm(`Cancel “${a.title}”? Bidders will see it as cancelled.`)) return;
    try {
      await cancelAuction(a.id);
      setNotice(`Cancelled “${a.title}”.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!users && !error) return <Spinner />;

  return (
    <div className="container page">
      <h1>Admin</h1>
      {notice && <p className="alert alert--success">{notice}</p>}
      {error && <p className="alert alert--error">{error}</p>}

      <section className="panel">
        <h2>Open auctions ({auctions?.length ?? 0})</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Auction</th>
                <th>Seller</th>
                <th>Status</th>
                <th>Bids</th>
                <th>Price</th>
                <th>Ends</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {auctions?.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/auctions/${a.id}`}>{a.title}</Link>
                  </td>
                  <td>{a.seller?.name}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>{a.bidCount}</td>
                  <td>{formatINR(a.bidCount ? a.currentBid : a.startingPrice)}</td>
                  <td>{formatDateTime(a.endTime)}</td>
                  <td>
                    <button className="btn btn--danger btn--sm" onClick={() => cancel(a)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Users ({users?.length ?? 0})</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role === 'admin' ? <strong>admin</strong> : 'user'}</td>
                  <td>{formatDateTime(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
