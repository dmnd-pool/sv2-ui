import type { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useBrokerAuth } from './BrokerAuthProvider';

/**
 * Sends anyone without a broker session to the broker sign-in page. Mirrors
 * AuthGuard, minus the ?next handling: brokers have a single landing route, so
 * there's nowhere else to return to after signing in.
 */
export function BrokerGuard({ children }: { children: ReactNode }) {
  const { session } = useBrokerAuth();

  if (!session) {
    return <Redirect to="/broker/signin" replace />;
  }

  return <>{children}</>;
}
