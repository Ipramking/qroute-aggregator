// Env-gated analytics + error tracking. Everything no-ops cleanly when the
// corresponding NEXT_PUBLIC_* keys are unset, and the SDKs are dynamically
// imported so they add zero bundle weight unless actually configured.

let initialized = false;
let posthogRef: any = null;
let sentryRef: any = null;

export async function initAnalytics(): Promise<void> {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    try {
      const Sentry = await import("@sentry/browser");
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_ENV || "production",
        tracesSampleRate: 0.1,
      });
      sentryRef = Sentry;
    } catch {
      /* ignore */
    }
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key) {
    try {
      const posthog = (await import("posthog-js")).default;
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        person_profiles: "identified_only",
      });
      posthogRef = posthog;
    } catch {
      /* ignore */
    }
  }
}

export function track(event: string, props?: Record<string, unknown>): void {
  try {
    posthogRef?.capture(event, props);
  } catch {
    /* ignore */
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  try {
    sentryRef?.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* ignore */
  }
  // Always surface in the console for local debugging.
  // eslint-disable-next-line no-console
  console.error(err);
}
