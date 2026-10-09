/** Admin's header search — the same bar, Admin's scope. Lazy, like the app's. */
import Spotlight from "./Spotlight.tsx";
import { adminScope } from "./adminScope.ts";

export default function AdminSpotlight(props: { width: number; panel: { x: number; width: number } }) {
  return <Spotlight {...props} scope={adminScope} />;
}
