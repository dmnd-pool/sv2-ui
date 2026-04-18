import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aggregateSv2ClientChannels, fetchAllSv2Clients, usePoolData } from './usePoolData';
import type { ClientWithChannels } from '@/types/api';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('usePoolData', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aggregates channels across clients and keeps partial failures visible', async () => {
    const clients: ClientWithChannels[] = [
      {
        client_id: 1,
        extended_channels_count: 1,
        standard_channels_count: 0,
        total_hashrate: 1200,
        extended_channels: [{ channel_id: 'extended-a', channel_id_str: 'extended-a' } as never],
        standard_channels: [],
      } as unknown as ClientWithChannels,
      {
        client_id: 2,
        extended_channels_count: 0,
        standard_channels_count: 1,
        total_hashrate: 800,
        extended_channels: [],
        standard_channels: [{ channel_id: 'standard-b', channel_id_str: 'standard-b' } as never],
      } as unknown as ClientWithChannels,
    ];

    expect(aggregateSv2ClientChannels(clients)).toEqual({
      total_extended: 1,
      total_standard: 1,
      extended_channels: [{ channel_id: 'extended-a', channel_id_str: 'extended-a' }],
      standard_channels: [{ channel_id: 'standard-b', channel_id_str: 'standard-b' }],
    });

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/global')) {
        return Promise.resolve(createJsonResponse({ connected_clients: 2 }));
      }

      if (url.endsWith('/server/channels?offset=0&limit=100')) {
        return Promise.resolve(createJsonResponse({ shares: 8, best_diff: 42 }));
      }

      if (url.endsWith('/clients?offset=0&limit=100')) {
        return Promise.resolve(createJsonResponse({
          items: [
            { client_id: 1, extended_channels_count: 1, standard_channels_count: 0, total_hashrate: 1200 },
            { client_id: 2, extended_channels_count: 0, standard_channels_count: 1, total_hashrate: 800 },
          ],
        }));
      }

      if (url.includes('/clients/1/channels')) {
        return Promise.resolve(createJsonResponse({
          client_id: 1,
          offset: 0,
          limit: 100,
          total_extended: 1,
          total_standard: 0,
          extended_channels: [{ channel_id: 'extended-a', channel_id_str: 'extended-a' }],
          standard_channels: [],
        }));
      }

      if (url.includes('/clients/2/channels')) {
        return Promise.reject(new Error('timeout'));
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result } = renderHook(() => usePoolData('jd'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.global).toBeDefined();
      expect(result.current.sv2Clients).toBeDefined();
      expect(result.current.clientChannels).toBeDefined();
    });

    expect(result.current.isJdMode).toBe(true);
    expect(result.current.modeLabel).toBe('JD Client');
    expect(result.current.sv2Clients).toHaveLength(2);
    expect(result.current.clientChannels).toEqual({
      total_extended: 1,
      total_standard: 0,
      extended_channels: [{ channel_id: 'extended-a', channel_id_str: 'extended-a' }],
      standard_channels: [],
    });

    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).toContain('/jdc-api/v1/global');
    expect(requestedUrls).toContain('/jdc-api/v1/server/channels?offset=0&limit=100');
    expect(requestedUrls).toContain('/jdc-api/v1/clients?offset=0&limit=100');
    expect(requestedUrls).toContain('/jdc-api/v1/clients/1/channels?offset=0&limit=100');
    expect(requestedUrls).toContain('/jdc-api/v1/clients/2/channels?offset=0&limit=100');
  });

  it('fetchAllSv2Clients returns empty channel lists when an individual client request fails', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/clients?offset=0&limit=100')) {
        return Promise.resolve(createJsonResponse({
          items: [
            { client_id: 1, extended_channels_count: 1, standard_channels_count: 0, total_hashrate: 1200 },
            { client_id: 2, extended_channels_count: 0, standard_channels_count: 1, total_hashrate: 800 },
          ],
        }));
      }

      if (url.includes('/clients/1/channels')) {
        return Promise.resolve(createJsonResponse({
          client_id: 1,
          offset: 0,
          limit: 100,
          total_extended: 1,
          total_standard: 0,
          extended_channels: [{ channel_id: 'extended-a', channel_id_str: 'extended-a' }],
          standard_channels: [],
        }));
      }

      if (url.includes('/clients/2/channels')) {
        return Promise.reject(new Error('network down'));
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const clients = await fetchAllSv2Clients('/translator-api/v1');

    expect(clients).toEqual([
      {
        client_id: 1,
        extended_channels_count: 1,
        standard_channels_count: 0,
        total_hashrate: 1200,
        extended_channels: [{ channel_id: 'extended-a', channel_id_str: 'extended-a' }],
        standard_channels: [],
      },
      {
        client_id: 2,
        extended_channels_count: 0,
        standard_channels_count: 1,
        total_hashrate: 800,
        extended_channels: [],
        standard_channels: [],
      },
    ]);
  });
});