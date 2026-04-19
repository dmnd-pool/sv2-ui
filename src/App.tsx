import { useEffect, type ReactNode } from 'react';
import { Switch, Route, useLocation } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { UnifiedDashboard } from '@/pages/UnifiedDashboard';
import { Settings } from '@/pages/Settings';
import { Setup } from '@/pages/Setup';
import { Login } from '@/pages/Login';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { AuthProvider } from '@/auth/AuthProvider';
import { AuthGuard } from '@/auth/AuthGuard';

/**
 * SV2 Mining Stack UI
 *
 * Supports two deploy shapes from a single binary:
 * - Orchestration mode: local operator runs the stack via docker. Backend is
 *   present (`/api/status` responds). No miner auth — the operator is trusted.
 * - Miner portal mode: hosted dashboard, no orchestration backend. Miner auth
 *   is enforced via `AuthGuard` (DMND token-based — no roles).
 */
function MinerAuthOrPassthrough({ children }: { children: ReactNode }) {
  const { isOrchestrated } = useSetupStatus();
  if (isOrchestrated) return <>{children}</>;
  return <AuthGuard>{children}</AuthGuard>;
}

function Router() {
  const [location, navigate] = useLocation();
  const { isLoading, isOrchestrated, needsSetup } = useSetupStatus();

  useEffect(() => {
    if (!isLoading && isOrchestrated && needsSetup && location !== '/setup') {
      navigate('/setup');
    }
  }, [isLoading, isOrchestrated, needsSetup, location, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 mx-auto rounded-lg bg-primary animate-pulse flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SV2</span>
          </div>
          <p className="text-sm text-muted-foreground">Checking configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        <Login />
      </Route>
      <Route path="/setup">
        <Setup />
      </Route>
      <Route path="/">
        <MinerAuthOrPassthrough>
          <UnifiedDashboard />
        </MinerAuthOrPassthrough>
      </Route>
      <Route path="/settings">
        <MinerAuthOrPassthrough>
          <Settings />
        </MinerAuthOrPassthrough>
      </Route>
      <Route>
        <MinerAuthOrPassthrough>
          <UnifiedDashboard />
        </MinerAuthOrPassthrough>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
