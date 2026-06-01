/**
 * Shared icon vocabulary for the Applications row + detail sidebar. Keeping
 * these in one file means the row and sidebar render *identical* glyphs next
 * to identical labels — the visual rhythm the user asked for.
 *
 * Backed by lucide-react — see /Users/manav/Projects/Hire Trail/PRODUCT_AUDIT.md
 * for the migration context. We expose a small `Icons` map so callers don't
 * have to import a different Lucide name per field.
 */
import type { ComponentProps } from "react";
import {
  MapPin, DollarSign, Briefcase, FileText, User, Clock,
  StickyNote, FileEdit, Building2, Calendar, Settings,
  type LucideIcon,
} from "lucide-react";

/** Default render props — keep size + stroke consistent across the row. */
const baseProps = { size: 12, strokeWidth: 1.8 } as const;

type IconProps = Partial<ComponentProps<LucideIcon>>;

function wrap(Icon: LucideIcon) {
  return (p: IconProps = {}) => <Icon {...baseProps} {...p} />;
}

export const Icons = {
  location: wrap(MapPin),
  salary:   wrap(DollarSign),
  jobType:  wrap(Briefcase),
  resume:   wrap(FileText),
  contact:  wrap(User),
  deadline: wrap(Clock),
  notes:    wrap(StickyNote),
  jd:       wrap(FileEdit),
  company:  wrap(Building2),
  calendar: wrap(Calendar),
  source:   wrap(Settings),
} as const;

export type IconKey = keyof typeof Icons;
