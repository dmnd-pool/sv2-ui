import { Switch, Route, Redirect } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHome } from '@/pages/dashboard/DashboardHome';
import { AccountSetup } from '@/pages/account-setup/AccountSetup';
import { WorkersPage } from '@/pages/workers/WorkersPage';
import { SubaccountsPage } from '@/pages/subaccounts/SubaccountsPage';
import { GeneratedBtcPage } from '@/pages/generated-btc/GeneratedBtcPage';
import { PayoutsPage } from '@/pages/payouts/PayoutsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { HelpPage } from '@/pages/help/HelpPage';
import { BuildYourBlockPage } from '@/pages/build-your-block/BuildYourBlockPage';
import { JobDeclarationPage } from '@/pages/build-your-block/JobDeclarationPage';
import { PrioritizeTransactionsPage } from '@/pages/build-your-block/PrioritizeTransactionsPage';
import { MergeMiningPage } from '@/pages/build-your-block/MergeMiningPage';
import { WatcherLinksPage } from '@/pages/watcher-links/WatcherLinksPage';
import { PplnsProjectionPage } from '@/pages/pplns-projection/PplnsProjectionPage';
import { WatcherView } from '@/pages/watcher-links/WatcherView';
import { MultiwatcherView } from '@/pages/watcher-links/MultiwatcherView';
import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { BrokerSignIn } from '@/pages/auth/BrokerSignIn';
import { WatcherSignIn } from '@/pages/auth/WatcherSignIn';
import { BrokerSignUp } from '@/pages/auth/BrokerSignUp';
import { BrokerHome } from '@/pages/broker/BrokerHome';
import { BrokerSettings } from '@/pages/broker/BrokerSettings';
import { AuthProvider, AuthGuard, BrokerAuthProvider, BrokerGuard } from '@/auth';
import { ToastProvider } from '@/components/ui/toast';

/**
 * The authenticated area, reached only after sign-in (AuthGuard).
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
      <Route path="/pplns-projection">
        <DashboardShell>
          <PplnsProjectionPage />
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
      <Route path="/build-your-block">
        <DashboardShell>
          <BuildYourBlockPage />
        </DashboardShell>
      </Route>
      <Route path="/build-your-block/job-declaration/:section?">
        <DashboardShell>
          <JobDeclarationPage />
        </DashboardShell>
      </Route>
      <Route path="/build-your-block/merge-mining/:section?">
        <DashboardShell>
          <MergeMiningPage />
        </DashboardShell>
      </Route>
      <Route path="/build-your-block/prioritize-transactions/:section?">
        <DashboardShell>
          <PrioritizeTransactionsPage />
        </DashboardShell>
      </Route>
      {/* Full-screen account-setup flow, reached from the home prompt. */}
      <Route path="/account-setup">
        <AccountSetup />
      </Route>
      {/* The dashboard is the authenticated landing page. */}
      <Route path="/">
        <Redirect to="/home" replace />
      </Route>
      {/* Unknown authenticated routes return to the dashboard. */}
      <Route>
        <Redirect to="/home" replace />
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
      <Route path="/watcher/signin">
        <WatcherSignIn />
      </Route>
      <Route path="/broker/signup">
        <BrokerSignUp />
      </Route>
      <Route path="/broker/settings">
        <BrokerGuard>
          <BrokerSettings />
        </BrokerGuard>
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
