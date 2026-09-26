/** Where "Back to HireTrail" returns to: the last page the user was on in the
 *  app shell (path + query, so filters and views come back too). Tab-scoped —
 *  sessionStorage survives reloads and the OAuth round-trip through Settings,
 *  and a fresh tab starts clean. */
const KEY = "hiretrail-return-path";

export function rememberAppPath(path: string): void {
  try { sessionStorage.setItem(KEY, path); } catch { /* storage disabled */ }
}

export function appReturnPath(): string {
  try {
    const v = sessionStorage.getItem(KEY);
    // Only same-app paths — never an absolute URL someone wrote in.
    return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
  } catch {
    return "/";
  }
}
