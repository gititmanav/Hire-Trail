/** What one header's search knows — the app's (appScope.ts) or Admin's
 *  (adminScope.ts). Spotlight is the same bar for both; a scope supplies the
 *  pages it finds, the records it searches, the quick-link catalogue and where
 *  the chosen links are saved. The hooks run inside Spotlight, so a mounted
 *  bar keeps its scope for life (each header passes one constant). */
import type { LucideIcon } from "lucide-react";

import type { SearchResult } from "./searchIndex.ts";

export interface QuickLink {
  id: string;
  label: string;
  path: string;
  Icon: LucideIcon;
  /** A feature flag the page lives behind. */
  flag?: string;
}

export interface SavedLinks {
  links: string[];
  available: (id: string) => boolean;
  setLinks: (next: string[]) => void;
}

export interface SpotlightScope {
  /** The input's accessible name. */
  label: string;
  pages: SearchResult[];
  /** Records for a query, fetched only once `enabled` (the bar was used). */
  useRecords: (enabled: boolean, query: string) => { data?: SearchResult[]; isPending: boolean };
  /** The row shown while records load. */
  searchingText: string;
  /** Catalogue order (the editor's grid). */
  catalog: QuickLink[];
  useLinks: () => SavedLinks;
  /** Links that carry a dot, with what a screen reader hears ("3 unread"). */
  useBadges: () => Partial<Record<string, string>>;
}
