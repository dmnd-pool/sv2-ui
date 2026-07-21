import { useEffect } from 'react';
import { Switch, Route, Redirect, useLocation } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { UnifiedDashboard } from '@/pages/UnifiedDashboard';
import { Settings } from '@/pages/Settings';
import { Setup } from '@/pages/Setup';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHome } from '@/pages/dashboard/DashboardHome';
import { AccountSetup } from '@/pages/account-setup/AccountSetup';
import { WorkersPage } from '@/pages/workers/WorkersPage';
import { SubaccountsPage } from '@/pages/subaccounts/SubaccountsPage';
import { GeneratedBtcPage } from '@/pages/generated-btc/GeneratedBtcPage';
import { PayoutsPage } from '@/pages/payouts/PayoutsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { HelpPage } from '@/pages/help/HelpPage';
import { WatcherLinksPage } from '@/pages/watcher-links/WatcherLinksPage';
import { WatcherView } from '@/pages/watcher-links/WatcherView';
import { MultiwatcherView } from '@/pages/watcher-links/MultiwatcherView';
import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { BrokerSignIn } from '@/pages/auth/BrokerSignIn';
import { BrokerSignUp } from '@/pages/auth/BrokerSignUp';
import { BrokerHome } from '@/pages/broker/BrokerHome';
import { AuthProvider, AuthGuard, BrokerAuthProvider, BrokerGuard } from '@/auth';
import { ToastProvider } from '@/components/ui/toast';
import { FullScreenStatus } from '@/components/layout/FullScreenStatus';
import { useSetupStatus } from '@/hooks/useSetupStatus';

/**
 * The local mining-stack area (translator / JDC telemetry from the Express
 * server). Its setup redirect only concerns that local stack, so it stays
 * scoped here rather than gating the DMND dashboard pages.
 */
function LocalRoutes() {
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
      <Route path="/local">
        <UnifiedDashboard />
      </Route>
      {/* Fallback to the local dashboard */}
      <Route>
        <UnifiedDashboard />
      </Route>
    </Switch>
  );
}

/**
 * The authenticated area, reached only after sign-in (AuthGuard). DMND dashboard
 * pages render inside the sidebar shell; the local mining-stack views keep their
 * routes (/local, /settings, /setup) via LocalRoutes.
 */
function AppRoutes() {
  return (
    <Switch>
      <Route path="/home">
        <DashboardShell>
          <DashboardHome />
        </DashboardShell>
      </Route>
      <Route path="/workers">
        <DashboardShell>
          <WorkersPage />
        </DashboardShell>
      </Route>
      <Route path="/subaccounts">
        <DashboardShell>
          <SubaccountsPage />
        </DashboardShell>
      </Route>
      <Route path="/payouts">
        <DashboardShell>
          <PayoutsPage />
        </DashboardShell>
      </Route>
      <Route path="/generated-bitcoin">
        <DashboardShell>
          <GeneratedBtcPage />
        </DashboardShell>
      </Route>
      <Route path="/watcher-links">
        <DashboardShell>
          <WatcherLinksPage />
        </DashboardShell>
      </Route>
      <Route path="/account">
        <DashboardShell>
          <SettingsPage />
        </DashboardShell>
      </Route>
      <Route path="/help">
        <DashboardShell>
          <HelpPage />
        </DashboardShell>
      </Route>
      {/* Full-screen account-setup flow, reached from the home prompt. */}
      <Route path="/account-setup">
        <AccountSetup />
      </Route>
      {/* The DMND dashboard is the landing; the local stratum view lives at /local. */}
      <Route path="/">
        <Redirect to="/home" replace />
      </Route>
      {/* Everything else is the local mining-stack surface. */}
      <Route>
        <LocalRoutes />
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
        <BrokerSignIn />
      </Route>
      <Route path="/broker/signup">
        <BrokerSignUp />
      </Route>
      <Route path="/broker">
        <BrokerGuard>
          <BrokerHome />
        </BrokerGuard>
      </Route>
      {/* Public read-only Watcher View: opened via a shared link, authenticated by
          the token in the URL, so it sits outside the miner AuthGuard. */}
      <Route path="/login/watcher/:userId/:token">
        {(params) => <WatcherView userId={params.userId} token={params.token} />}
      </Route>
      {/* Public multiwatcher view: a client-composed bundle of watcher tokens; the
          mode plus the (account, token) pairs ride in the path tail (a wildcard so
          the whole tail is captured, not just one segment). */}
      <Route path="/login/multiwatcher/*">
        {(params) => <MultiwatcherView rest={params['*'] ?? ''} />}
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
          <BrokerAuthProvider>
            <Router />
          </BrokerAuthProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
