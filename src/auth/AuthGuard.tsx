import type { ReactNode } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuth } from './useAuth';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { session } = useAuth();
  const [location] = useLocation();

  if (!session) {
    const next = encodeURIComponent(location);
    return <Redirect to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
