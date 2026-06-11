import { useEffect } from 'react';
import { Switch, Route, useLocation } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { UnifiedDashboard } from '@/pages/UnifiedDashboard';
import { Settings } from '@/pages/Settings';
import { Setup } from '@/pages/Setup';
import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { BrokerComingSoon } from '@/pages/auth/BrokerComingSoon';
import { AuthProvider, AuthGuard } from '@/auth';
import { ToastProvider } from '@/components/ui/toast';
import { FullScreenStatus } from '@/components/layout/FullScreenStatus';
import { useSetupStatus } from '@/hooks/useSetupStatus';

/**
 * The authenticated dashboard area, reached only after sign-in (AuthGuard). The
 * setup redirect here concerns the local mining stack.
 */
function AppRoutes() {
  const [location, navigate] = useLocation();
  const { isLoading, isOrchestrated, needsSetup } = useSetupStatus();

  useEffect(() => {
    if (!isLoading && isOrchestrated && needsSetup && location !== '/setup') {
      navigate('/setup');
    }
  }, [isLoading, isOrchestrated, needsSetup, location, navigate]);

  if (isLoading) {
    return <FullScreenStatus message="Checking configuration..." />;
  }

  return (
    <Switch>
      <Route path="/setup">
        <Setup />
      </Route>
      <Route path="/settings">
        <Settings />
      </Route>
      <Route path="/">
        <UnifiedDashboard />
      </Route>
      {/* Fallback to dashboard */}
      <Route>
        <UnifiedDashboard />
      </Route>
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/signin">
        <SignIn />
      </Route>
      <Route path="/signup">
        <SignUp />
      </Route>
      {/* Both enter the one continuous recovery flow (email -> token -> ...). */}
      <Route path="/forgot-password">
        <ResetPassword />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>
      <Route path="/broker/signin">
        <BrokerComingSoon />
      </Route>
      <Route path="/broker/signup">
        <BrokerComingSoon />
      </Route>
      {/* Everything else requires a signed-in miner */}
      <Route>
        <AuthGuard>
          <AppRoutes />
        </AuthGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <Router />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
