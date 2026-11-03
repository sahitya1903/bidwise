import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const close = () => setOpen(false);

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand__mark" aria-hidden="true">
            B
          </span>
          BidWise
        </Link>
        <button
          className="navbar__toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
        <nav id="main-nav" className={`navbar__links${open ? ' is-open' : ''}`}>
          <NavLink to="/" end onClick={close}>
            Browse
          </NavLink>
          {user && (
            <>
              <NavLink to="/sell" onClick={close}>
                Sell
              </NavLink>
              <NavLink to="/me/bids" onClick={close}>
                My bids
              </NavLink>
              <NavLink to="/me/listings" onClick={close}>
                My listings
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" onClick={close}>
                  Admin
                </NavLink>
              )}
              <span className="navbar__user" title={user.email}>
                {user.name}
              </span>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  logout();
                  close();
                  navigate('/');
                }}
              >
                Log out
              </button>
            </>
          )}
          {!user && (
            <>
              <NavLink to="/login" onClick={close}>
                Log in
              </NavLink>
              <Link to="/register" className="btn btn--primary btn--sm" onClick={close}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
