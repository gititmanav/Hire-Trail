/** The app header's search. Its own lazy entry, so the motion engine and the
 *  search stay out of the shell's first chunk. */
import Spotlight from "./Spotlight.tsx";
import { appScope } from "./appScope.ts";

export default function AppSpotlight(props: { width: number; panel: { x: number; width: number } }) {
  return <Spotlight {...props} scope={appScope} />;
}
