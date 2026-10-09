/** The List view, read the way the person chose in Personalize: Ledger (the
 *  stage-aware table, in this chunk — it's the default), Trail (a timeline)
 *  or Desk (the list beside the application), each its own chunk. */
import { lazy } from "react";
import { useApplicationsShell } from "../ApplicationsLayout.tsx";
import LedgerList from "./ledger/LedgerList.tsx";

const TrailView = lazy(() => import("./trail/TrailView.tsx"));
const DeskView = lazy(() => import("./desk/DeskView.tsx"));

export default function ListView() {
  const { design } = useApplicationsShell();
  if (design === "trail") return <TrailView />;
  if (design === "desk") return <DeskView />;
  return <LedgerList />;
}
