import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO = ['alice', 'bob', 'carol', 'admin'];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container page page--narrow">
      <div className="panel auth-panel">
        <h1>Welcome back</h1>
        {location.state?.from && <p className="muted">Log in to continue.</p>}
        <form onSubmit={submit} className="form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="muted small">
          New here? <Link to="/register">Create an account</Link>
        </p>
        <details className="demo-accounts">
          <summary>Demo accounts</summary>
          <p className="small muted">Password for all: Password1</p>
          <div className="chips">
            {DEMO.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                onClick={() => setForm({ email: `${name}@bidwise.test`, password: 'Password1' })}
              >
                {name}
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
