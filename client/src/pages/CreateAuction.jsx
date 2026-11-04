import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createAuction, getAuction, updateAuction } from '../api/auctions';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import { CATEGORIES, formatINR, paiseToRupeesInput, rupeesToPaise, toLocalInput } from '../utils/format';

const MIN = 60 * 1000;
const DURATIONS = [
  { label: '3 minutes (demo)', ms: 3 * MIN },
  { label: '10 minutes', ms: 10 * MIN },
  { label: '1 hour', ms: 60 * MIN },
  { label: '1 day', ms: 24 * 60 * MIN },
  { label: '3 days', ms: 3 * 24 * 60 * MIN },
  { label: '7 days', ms: 7 * 24 * 60 * MIN },
];

const EMPTY = {
  title: '',
  description: '',
  category: 'Other',
  imageUrl: '',
  startingPrice: '',
  reservePrice: '',
  minIncrement: '100',
  startMode: 'now',
  startTime: '',
  endMode: '3600000',
  endTime: '',
};

// Mirrors the server rules (BR-01, BR-02) for instant feedback. The server checks again.
function validate(f, now = Date.now()) {
  const e = {};
  const start = rupeesToPaise(f.startingPrice);
  const reserve = f.reservePrice === '' ? 0 : rupeesToPaise(f.reservePrice);
  const inc = rupeesToPaise(f.minIncrement);
  if (f.title.trim().length < 3) e.title = 'Title must be at least 3 characters';
  if (f.imageUrl && !/^https?:\/\/\S+$/i.test(f.imageUrl)) e.imageUrl = 'Image URL must start with http:// or https://';
  if (Number.isNaN(start) || start < 100) e.startingPrice = 'Starting price must be at least ₹1';
  if (Number.isNaN(inc) || inc < 100) e.minIncrement = 'Minimum increment must be at least ₹1';
  if (Number.isNaN(reserve)) e.reservePrice = 'Enter an amount in rupees';
  else if (reserve !== 0 && !Number.isNaN(start) && reserve < start)
    e.reservePrice = `Reserve must be empty (no reserve) or at least the starting price (${formatINR(start)})`;

  const startAt = f.startMode === 'now' ? now : new Date(f.startTime).getTime();
  const endAt = f.endMode === 'custom' ? new Date(f.endTime).getTime() : startAt + Number(f.endMode);
  if (f.startMode === 'later' && (Number.isNaN(startAt) || startAt <= now)) e.startTime = 'Pick a start time in the future';
  if (f.endMode === 'custom' && Number.isNaN(endAt)) e.endTime = 'Pick an end time';
  else if (endAt <= startAt) e.endTime = 'End time must be after the start time';
  else if (endAt - startAt < MIN) e.endTime = 'An auction must run for at least 1 minute';
  else if (endAt - startAt > 30 * 24 * 60 * MIN) e.endTime = 'An auction can run for at most 30 days';
  else if (endAt <= now) e.endTime = 'End time must be in the future';

  const payload = {
    title: f.title.trim(),
    description: f.description.trim(),
    category: f.category,
    imageUrl: f.imageUrl.trim(),
    startingPrice: start,
    reservePrice: reserve,
    minIncrement: inc,
    endTime: new Date(endAt).toISOString(),
  };
  if (f.startMode === 'later' && !e.startTime) payload.startTime = new Date(startAt).toISOString();
  return { errors: e, payload };
}

export default function CreateAuction() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const [lockedStart, setLockedStart] = useState(false);

  useEffect(() => {
    if (!editing) return;
    getAuction(id)
      .then((a) => {
        if (a.seller?.id !== user.id) throw new Error('Only the seller can edit this auction');
        if (a.bidCount > 0) throw new Error('This auction already has bids and can no longer be changed');
        setLockedStart(a.status === 'ACTIVE');
        setForm({
          title: a.title,
          description: a.description || '',
          category: a.category,
          imageUrl: a.imageUrl || '',
          startingPrice: paiseToRupeesInput(a.startingPrice),
          reservePrice: paiseToRupeesInput(a.reservePrice),
          minIncrement: paiseToRupeesInput(a.minIncrement),
          startMode: a.status === 'SCHEDULED' ? 'later' : 'now',
          startTime: toLocalInput(a.startTime),
          endMode: 'custom',
          endTime: toLocalInput(a.endTime),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [editing, id, user.id]);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const { errors: found, payload } = validate(form);
    if (editing && lockedStart) delete found.startTime;
    setErrors(found);
    if (Object.keys(found).length) {
      setError('Please fix the highlighted fields.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editing && lockedStart) delete payload.startTime;
      const saved = editing ? await updateAuction(id, payload) : await createAuction(payload);
      navigate(`/auctions/${saved.id}`);
    } catch (err) {
      setErrors(err.details?.fields || {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <Spinner />;

  const fieldError = (name) => errors[name] && <p className="field__error">{errors[name]}</p>;
  const now = new Date();

  return (
    <div className="container page page--medium">
      <h1>{editing ? 'Edit auction' : 'Sell an item'}</h1>
      <p className="muted">
        {editing ? 'You can change an auction until the first bid arrives.' : 'Set your price and how long bidding runs.'}
      </p>
      <form className="form panel" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" value={form.title} onChange={set('title')} aria-invalid={Boolean(errors.title)} maxLength={120} />
          {fieldError('title')}
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" rows={4} value={form.description} onChange={set('description')} maxLength={2000} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="imageUrl">Image URL (optional)</label>
            <input
              id="imageUrl"
              type="url"
              placeholder="https://…"
              value={form.imageUrl}
              onChange={set('imageUrl')}
              aria-invalid={Boolean(errors.imageUrl)}
            />
            {fieldError('imageUrl')}
          </div>
        </div>

        <fieldset className="fieldset">
          <legend>Pricing (₹)</legend>
          <div className="field-row field-row--3">
            <div className="field">
              <label htmlFor="startingPrice">Starting price</label>
              <input
                id="startingPrice"
                inputMode="decimal"
                value={form.startingPrice}
                onChange={set('startingPrice')}
                aria-invalid={Boolean(errors.startingPrice)}
              />
              {fieldError('startingPrice')}
            </div>
            <div className="field">
              <label htmlFor="minIncrement">Minimum increment</label>
              <input
                id="minIncrement"
                inputMode="decimal"
                value={form.minIncrement}
                onChange={set('minIncrement')}
                aria-invalid={Boolean(errors.minIncrement)}
              />
              {fieldError('minIncrement')}
            </div>
            <div className="field">
              <label htmlFor="reservePrice">Reserve price</label>
              <input
                id="reservePrice"
                inputMode="decimal"
                placeholder="No reserve"
                value={form.reservePrice}
                onChange={set('reservePrice')}
                aria-invalid={Boolean(errors.reservePrice)}
              />
              {errors.reservePrice ? fieldError('reservePrice') : <p className="field__hint">Hidden from bidders</p>}
            </div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Timing</legend>
          <div className="field-row">
            <div className="field">
              <label htmlFor="startMode">Start</label>
              <select id="startMode" value={form.startMode} onChange={set('startMode')} disabled={lockedStart}>
                <option value="now">{lockedStart ? 'Already running' : 'Right away'}</option>
                <option value="later">At a set time</option>
              </select>
              {form.startMode === 'later' && !lockedStart && (
                <input
                  aria-label="Start time"
                  type="datetime-local"
                  min={toLocalInput(now)}
                  value={form.startTime}
                  onChange={set('startTime')}
                  aria-invalid={Boolean(errors.startTime)}
                />
              )}
              {fieldError('startTime')}
            </div>
            <div className="field">
              <label htmlFor="endMode">{form.endMode === 'custom' ? 'End' : 'Duration'}</label>
              <select id="endMode" value={form.endMode} onChange={set('endMode')}>
                {DURATIONS.map((d) => (
                  <option key={d.ms} value={String(d.ms)}>
                    {d.label}
                  </option>
                ))}
                <option value="custom">Pick an end time…</option>
              </select>
              {form.endMode === 'custom' && (
                <input
                  aria-label="End time"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={set('endTime')}
                  aria-invalid={Boolean(errors.endTime)}
                />
              )}
              {fieldError('endTime')}
            </div>
          </div>
        </fieldset>

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Start auction'}
          </button>
          <Link to={editing ? `/auctions/${id}` : '/'} className="btn btn--ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
