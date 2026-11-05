import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import BidForm from '../components/BidForm';

describe('BidForm', () => {
  test('TC-37: with minimum ₹1,100, typing 1,050 disables submit and shows "Minimum ₹1,100"', async () => {
    const onSubmit = vi.fn();
    render(<BidForm minNextBid={110000} increment={10000} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Your bid'), '1050');
    expect(screen.getByRole('button', { name: 'Place bid' })).toBeDisabled();
    const hint = screen.getByText('Minimum ₹1,100');
    expect(hint).toHaveClass('is-error');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('exactly the minimum enables submit and sends paise', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<BidForm minNextBid={110000} increment={10000} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Your bid'), '1,100');
    const button = screen.getByRole('button', { name: 'Place bid' });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith(110000);
  });

  test('one paisa below the minimum (1099.99) stays disabled', async () => {
    render(<BidForm minNextBid={110000} increment={10000} onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Your bid'), '1099.99');
    expect(screen.getByRole('button', { name: 'Place bid' })).toBeDisabled();
  });

  test('shows the server error message when the bid is rejected', async () => {
    const onSubmit = vi.fn().mockRejectedValue({ message: 'You were outbid — new minimum is ₹1,200' });
    render(<BidForm minNextBid={110000} increment={10000} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: '₹1,100' }));
    await userEvent.click(screen.getByRole('button', { name: 'Place bid' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You were outbid — new minimum is ₹1,200');
  });

  test('text input is rejected', async () => {
    render(<BidForm minNextBid={110000} increment={10000} onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Your bid'), 'abc');
    expect(screen.getByText('Enter an amount in rupees')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place bid' })).toBeDisabled();
  });
});
