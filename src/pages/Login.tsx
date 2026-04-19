import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useSearch } from 'wouter';
import { Eye, EyeOff, ClipboardPaste } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/useAuth';
import { createSession } from '@/auth/session';
import { getDmndClient, DmndApiError } from '@/api/dmnd';

const loginSchema = z.object({
  token: z.string().trim().min(1, 'Paste your DMND token to continue'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type SubmitError =
  | { kind: 'unauthorized' }
  | { kind: 'network' }
  | { kind: 'server' }
  | { kind: 'unknown'; message: string };

function readNextParam(search: string): string {
  const params = new URLSearchParams(search);
  const next = params.get('next');
  if (!next) return '/';
  try {
    const decoded = decodeURIComponent(next);
    return decoded.startsWith('/') ? decoded : '/';
  } catch {
    return '/';
  }
}

function errorMessage(e: SubmitError): string {
  switch (e.kind) {
    case 'unauthorized':
      return 'That token is not recognized. Check for trailing spaces or ask your pool admin.';
    case 'network':
      return 'Cannot reach DMND right now. Check your connection and try again.';
    case 'server':
      return 'DMND is having trouble. Please try again in a moment.';
    case 'unknown':
      return e.message;
  }
}

export function Login() {
  const { signIn, signOutReason } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [showToken, setShowToken] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { token: '' },
  });

  const tokenValue = watch('token');
  const lastSubmittedToken = useRef<string | null>(null);

  useEffect(() => {
    if (
      submitError &&
      lastSubmittedToken.current !== null &&
      tokenValue.trim() !== lastSubmittedToken.current
    ) {
      setSubmitError(null);
    }
  }, [tokenValue, submitError]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const token = values.token.trim();
    lastSubmittedToken.current = token;
    try {
      const client = getDmndClient();
      const poolUrls = await client.getPoolUrls(token, { signal: controller.signal });
      signIn(createSession({ token, poolUrls }));
      navigate(readNextParam(search), { replace: true });
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof DmndApiError) {
        if (err.code === 'unauthorized') setSubmitError({ kind: 'unauthorized' });
        else if (err.code === 'network') setSubmitError({ kind: 'network' });
        else if (err.code === 'server') setSubmitError({ kind: 'server' });
        else setSubmitError({ kind: 'unknown', message: err.message });
      } else {
        setSubmitError({ kind: 'unknown', message: 'Unable to sign in. Please try again.' });
      }
    }
  });

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue('token', text.trim(), { shouldValidate: true, shouldDirty: true });
    } catch {
      // Clipboard unavailable (no permission or insecure context); user can type manually.
    }
  };

  const bannerText =
    signOutReason === 'duplicate_tab'
      ? 'You were signed out because another tab signed in with the same token.'
      : signOutReason === 'expired'
      ? 'Your session expired. Paste your token to sign in again.'
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to DMND</h1>
          <p className="text-sm text-muted-foreground">
            Paste the token from your DMND dashboard to continue.
          </p>
        </div>

        {bannerText && (
          <div
            role="status"
            className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          >
            {bannerText}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="token">DMND token</Label>
            <div className="relative">
              <Input
                id="token"
                type={showToken ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                className="pr-20"
                aria-invalid={errors.token ? 'true' : 'false'}
                aria-describedby={errors.token ? 'token-error' : submitError ? 'submit-error' : undefined}
                {...register('token')}
              />
              <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                  aria-label="Paste token from clipboard"
                  tabIndex={-1}
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                  aria-pressed={showToken}
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {errors.token && (
              <p id="token-error" className="text-xs text-destructive" role="alert">
                {errors.token.message}
              </p>
            )}
          </div>

          {submitError && (
            <p id="submit-error" className="text-xs text-destructive" role="alert">
              {errorMessage(submitError)}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying token...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
