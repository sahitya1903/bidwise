import { useState } from 'react';

// Falls back to a lettered tile when there is no image or it fails to load.
export default function AuctionImage({ src, title, category, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`auction-image auction-image--empty ${className}`} aria-hidden="true">
        <span>{(category || title || '?').charAt(0)}</span>
      </div>
    );
  }
  return (
    <img
      className={`auction-image ${className}`}
      src={src}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
