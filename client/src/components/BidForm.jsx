import { useState } from 'react';
import { formatINR, rupeesToPaise, paiseToRupeesInput } from '../utils/format';

// The bidder types rupees; the form sends paise. Instant feedback here, the server re-checks.
export default function BidForm({ minNextBid, increment, onSubmit, disabled = false }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amount = rupeesToPaise(value);
  const typed = value.trim() !== '';
  const notNumber = typed && Number.isNaN(amount);
  const tooLow = typed && !notNumber && amount < minNextBid;
  const canSubmit = typed && !notNumber && !tooLow && !submitting && !disabled;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(amount);
      setValue('');
    } catch (err) {
      setError(err?.message || 'Bid failed');
    } finally {
      setSubmitting(false);
    }
  }

  const quick = [minNextBid, minNextBid + increment, minNextBid + 5 * increment];

  return (
    <form className="bid-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="bid-amount" className="bid-form__label">
        Your bid
      </label>
      <div className="bid-form__row">
        <div className="money-input">
          <span aria-hidden="true">₹</span>
          <input
            id="bid-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder={paiseToRupeesInput(minNextBid)}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError('');
            }}
            aria-invalid={tooLow || notNumber}
            aria-describedby="bid-hint"
            disabled={disabled}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
          {submitting ? 'Placing…' : 'Place bid'}
        </button>
      </div>
      <p id="bid-hint" className={`bid-form__hint${tooLow || notNumber ? ' is-error' : ''}`}>
        {notNumber ? 'Enter an amount in rupees' : `Minimum ${formatINR(minNextBid)}`}
      </p>
      {!disabled && (
        <div className="chips" aria-label="Quick amounts">
          {quick.map((p) => (
            <button
              type="button"
              key={p}
              className="chip"
              onClick={() => {
                setValue(paiseToRupeesInput(p));
                setError('');
              }}
            >
              {formatINR(p)}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
