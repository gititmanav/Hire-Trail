/** The unread notification count, shared by the sidebar and the search's
 *  Notifications quick link (it was the header bell's). Polled on load, on
 *  focus and every five minutes — and that poll matters to the server too:
 *  GET /notifications/unread-count revives any AI job whose step stalled
 *  (backend services/ai/jobs.ts reviveAiJobs), so keep it running in the
 *  signed-in shell. One query key, so every reader shares one poll. */
import { useQuery } from "@tanstack/react-query";

import { notificationsAPI } from "../utils/api.ts";

export const UNREAD_KEY = ["notifications", "unread"] as const;

export function useUnreadNotifications(): number {
  const { data } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: ({ signal }) => notificationsAPI.getUnreadCount({ quiet: true, signal }).then((r) => r.count),
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    meta: { silent: true },
  });
  return data ?? 0;
}
