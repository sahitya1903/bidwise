import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import Countdown from '../components/Countdown';
import { formatDuration, formatINR, rupeesToPaise } from '../utils/format';

describe('Countdown', () => {
  afterEach(() => vi.useRealTimers());

  test('TC-38: end time in the past shows "Ended"', () => {
    render(<Countdown endTime={new Date(Date.now() - 1000).toISOString()} status="ACTIVE" />);
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  test('counts down every second and switches to "Ended" at zero', () => {
    vi.useFakeTimers();
    const end = new Date(Date.now() + 3000).toISOString();
    render(<Countdown endTime={end} status="ACTIVE" />);
    expect(screen.getByText(/Ends in/)).toHaveTextContent('Ends in 3s');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/Ends in/)).toHaveTextContent('Ends in 2s');
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  test('a scheduled auction counts down to its start', () => {
    const now = Date.now();
    render(
      <Countdown
        status="SCHEDULED"
        startTime={new Date(now + 2 * 3600 * 1000).toISOString()}
        endTime={new Date(now + 5 * 3600 * 1000).toISOString()}
      />
    );
    expect(screen.getByText(/Starts in/)).toBeInTheDocument();
  });
});

describe('format helpers', () => {
  test('money is converted between rupees and paise exactly', () => {
    expect(rupeesToPaise('1,099.99')).toBe(109999);
    expect(rupeesToPaise('0.1')).toBe(10);
    expect(rupeesToPaise('-5')).toBeNaN();
    expect(rupeesToPaise('1.234')).toBeNaN();
    expect(formatINR(110000)).toBe('₹1,100');
    expect(formatINR(109999)).toBe('₹1,099.99');
    expect(formatINR(12345600)).toBe('₹1,23,456');
  });

  test('durations are readable', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(65 * 1000)).toBe('1m 05s');
    expect(formatDuration(26 * 3600 * 1000 + 3 * 60 * 1000)).toBe('1d 2h 3m');
  });
});
