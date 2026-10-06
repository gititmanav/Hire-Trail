/** In-app navigation for code that lives outside React (the axios
 *  interceptor's toasts). `NavigationBridge` in App.tsx registers the router's
 *  navigate; before it mounts, a plain page load does the job. */
type Navigate = (to: string) => void;

let current: Navigate | null = null;

export function registerNavigate(fn: Navigate | null): void {
  current = fn;
}

export function appNavigate(to: string): void {
  if (current) current(to);
  else window.location.assign(to);
}
