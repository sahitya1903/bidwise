import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function check() {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    return e;
  }

  async function submit(e) {
    e.preventDefault();
    const found = check();
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setErrors(err.details?.fields || {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (name, label, type, autoComplete, hint) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        type={type}
        autoComplete={autoComplete}
        value={form[name]}
        aria-invalid={Boolean(errors[name])}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
      {errors[name] ? <p className="field__error">{errors[name]}</p> : hint && <p className="field__hint">{hint}</p>}
    </div>
  );

  return (
    <div className="container page page--narrow">
      <div className="panel auth-panel">
        <h1>Create your account</h1>
        <p className="muted">One account lets you both sell and bid.</p>
        <form onSubmit={submit} className="form" noValidate>
          {field('name', 'Name', 'text', 'name')}
          {field('email', 'Email', 'email', 'email')}
          {field('password', 'Password', 'password', 'new-password', 'At least 8 characters')}
          {error && !Object.keys(errors).length && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Creating…' : 'Sign up'}
          </button>
        </form>
        <p className="muted small">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
