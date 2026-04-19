import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { AuthProvider } from '@/auth/AuthProvider';
import { createAuthStore } from '@/auth/authStore';
import {
  DmndApiError,
  setDmndClient,
  createDmndClient,
  type DmndClient,
  type PoolAddress,
} from '@/api/dmnd';
import { Login } from './Login';

const poolUrls: PoolAddress[] = [{ host: 'pool.dmnd.work', port: 3333 }];

function renderLogin(initialPath = '/login') {
  const loc = memoryLocation({ path: initialPath, record: true });
  const store = createAuthStore({ channel: null });
  const utils = render(
    <Router hook={loc.hook}>
      <AuthProvider store={store}>
        <Login />
      </AuthProvider>
    </Router>
  );
  return { ...utils, loc, store };
}

function stubClient(impl: Partial<DmndClient>): DmndClient {
  return {
    getPoolUrls: impl.getPoolUrls ?? vi.fn().mockResolvedValue([]),
  };
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  setDmndClient(createDmndClient());
});

describe('Login page', () => {
  it('shows a zod error when token is empty', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/paste your dmnd token/i)).toBeInTheDocument();
  });

  it('trims whitespace and signs in with pool urls from the API', async () => {
    const getPoolUrls = vi.fn().mockResolvedValue(poolUrls);
    setDmndClient(stubClient({ getPoolUrls }));

    const user = userEvent.setup();
    const { loc, store } = renderLogin('/login?next=%2Fworkers');

    await user.type(screen.getByLabelText(/dmnd token/i), '  tok_abc  ');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(store.getSnapshot().session?.token).toBe('tok_abc');
    });
    expect(getPoolUrls).toHaveBeenCalledWith('tok_abc', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(store.getSnapshot().session?.poolUrls).toEqual(poolUrls);
    expect(loc.history[loc.history.length - 1]).toBe('/workers');
  });

  it('shows unauthorized message when DMND rejects the token', async () => {
    setDmndClient(
      stubClient({
        getPoolUrls: vi.fn().mockRejectedValue(new DmndApiError('Invalid token', 'unauthorized')),
      })
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/dmnd token/i), 'bad_token');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/not recognized/i)).toBeInTheDocument();
  });

  it('shows network message when DMND is unreachable', async () => {
    setDmndClient(
      stubClient({
        getPoolUrls: vi.fn().mockRejectedValue(new DmndApiError('offline', 'network')),
      })
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/dmnd token/i), 'tok_any');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/cannot reach dmnd/i)).toBeInTheDocument();
  });

  it('shows server message when DMND returns 5xx', async () => {
    setDmndClient(
      stubClient({
        getPoolUrls: vi.fn().mockRejectedValue(new DmndApiError('503', 'server')),
      })
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/dmnd token/i), 'tok_any');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/having trouble/i)).toBeInTheDocument();
  });

  it('clears a prior error as the user edits the token', async () => {
    setDmndClient(
      stubClient({
        getPoolUrls: vi.fn().mockRejectedValue(new DmndApiError('Invalid token', 'unauthorized')),
      })
    );

    const user = userEvent.setup();
    renderLogin();

    const input = screen.getByLabelText(/dmnd token/i);
    await user.type(input, 'bad_token');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/not recognized/i)).toBeInTheDocument();

    await user.type(input, 'x');
    expect(screen.queryByText(/not recognized/i)).not.toBeInTheDocument();
  });

  it('toggles token visibility when show/hide button is pressed', async () => {
    const user = userEvent.setup();
    renderLogin();

    const input = screen.getByLabelText(/dmnd token/i) as HTMLInputElement;
    expect(input.type).toBe('password');

    await user.click(screen.getByRole('button', { name: /show token/i }));
    expect(input.type).toBe('text');

    await user.click(screen.getByRole('button', { name: /hide token/i }));
    expect(input.type).toBe('password');
  });
});
