export interface PoolAddress {
  host: string;
  port: number;
}

export type DmndApiErrorCode = 'unauthorized' | 'network' | 'server' | 'unknown';

export class DmndApiError extends Error {
  constructor(message: string, public readonly code: DmndApiErrorCode) {
    super(message);
    this.name = 'DmndApiError';
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface DmndClient {
  getPoolUrls(token: string, req?: RequestOptions): Promise<PoolAddress[]>;
}
