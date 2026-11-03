export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__dot" aria-hidden="true" />
      {label}
    </div>
  );
}
