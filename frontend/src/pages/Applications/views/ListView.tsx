/** List view — renders the design chosen in the header's (dev-only) toggle.
 *  Classic stays the default for everyone until the owner picks one. */
import { useApplicationsShell } from "../ApplicationsLayout.tsx";
import ClassicList from "./ClassicList.tsx";
import TableList from "./TableList.tsx";

export default function ListView() {
  const { design } = useApplicationsShell();
  return design === "table" ? <TableList /> : <ClassicList />;
}
