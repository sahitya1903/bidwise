import { useEffect, useState } from 'react';
import { formatDuration } from '../utils/format';

// Shows time left until endTime and ticks every second. Shows "Ended" once it has passed.
export default function Countdown({ endTime, startTime, status, compact = false }) {
  const [now, setNow] = useState(() => Date.now());
  const end = new Date(endTime).getTime();
  const start = startTime ? new Date(startTime).getTime() : null;
  const isScheduled = status === 'SCHEDULED' && start && start > now;
  const target = isScheduled ? start : end;
  const left = target - now;
  const done = left <= 0;

  useEffect(() => {
    if (done) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [done]);

  if (left <= 0 && !isScheduled) {
    return <span className="countdown countdown--ended">Ended</span>;
  }
  const urgent = !isScheduled && left < 5 * 60 * 1000;
  return (
    <span className={`countdown${urgent ? ' countdown--urgent' : ''}`} aria-live="off">
      {!compact && (isScheduled ? 'Starts in ' : 'Ends in ')}
      <time dateTime={new Date(target).toISOString()}>{formatDuration(left)}</time>
    </span>
  );
}
