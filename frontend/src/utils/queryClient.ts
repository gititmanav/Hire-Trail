/** App-wide TanStack Query client.
 *
 *  - staleTime 30s: switching views or coming back to a list renders from cache
 *    instantly, then refreshes in the background if the data is older.
 *  - One silent retry for transient failures (network, 5xx, 429): the error
 *    that finally surfaces is real, not a blip — e.g. a serverless instance
 *    thawing mid-request. 4xx errors are the client's fault; never retried.
 *  - Query requests pass `quiet: true`, so the axios interceptor doesn't toast
 *    on the first failure; QueryCache.onError toasts once retries are spent.
 */
import { QueryCache, QueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import toast from "react-hot-toast";

function isRetryable(error: unknown): boolean {
  const status = (error as AxiosError)?.response?.status;
  if (status == null) return true; // network error / aborted mid-flight
  return status >= 500 || status === 429;
}

/** The user-facing sentence for a failed load. Never a raw exception string. */
function describe(error: unknown, fallback: string): string {
  const ax = error as AxiosError<{ error?: unknown }>;
  const serverMsg = ax?.response?.data?.error;
  const status = ax?.response?.status;
  if (status === 429) return "Too many requests. Please slow down.";
  if (typeof serverMsg === "string" && serverMsg && status && status < 500) return serverMsg;
  if (status == null) return "You appear to be offline. Retrying when you're back.";
  return fallback;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // A background refetch that fails while we still hold good data stays
      // silent — the screen is still correct, and the next focus retries.
      if (query.state.data !== undefined) return;
      // The screen renders its own error state for this query (e.g. a 404 page).
      if (query.meta?.silent) return;
      const fallback = (query.meta?.errorMessage as string | undefined) ?? "Couldn't load this. Please try again.";
      const msg = describe(error, fallback);
      toast.error(msg, { id: `query:${msg}` });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => failureCount < 1 && isRetryable(error),
      retryDelay: 600,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
