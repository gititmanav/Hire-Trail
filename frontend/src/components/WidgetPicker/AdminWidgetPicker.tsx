import {
  Minus, LayoutGrid, TrendingUp, BarChart3, AlignLeft, ChevronsRight, Building2, Users,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_WIDGETS } from "../../hooks/useAdminWidgetLayout.ts";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal.tsx";
import Button from "../ui/Button.tsx";
const IC: Record<string, LucideIcon> = {
  stats: LayoutGrid,
  "user-growth": TrendingUp,
  "apps-per-day": BarChart3,
  activity: AlignLeft,
  "conversion-rates": ChevronsRight,
  funnel: BarChart3,
  "top-companies": Building2,
  "top-roles": Users,
  summary: BarChart3,
};
interface Props { visible: Record<string, boolean>; onToggle: (id: string) => void; onReset: () => void; onClose: () => void; }
export default function AdminWidgetPicker({ visible, onToggle, onReset, onClose }: Props) {
  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Dashboard widgets" description="Toggle widgets to show or hide them on your admin dashboard." onClose={onClose} />
      <ModalBody className="space-y-2">{ADMIN_WIDGETS.map((w) => {
        const Icon = IC[w.id] || Minus;
        return (
        <button key={w.id} onClick={() => onToggle(w.id)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border ${visible[w.id] ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
          <Icon size={20} strokeWidth={1.5} className={visible[w.id] ? "text-primary" : "text-muted-foreground"} />
          <span className={`text-sm font-medium ${visible[w.id] ? "text-foreground" : "text-muted-foreground"}`}>{w.title}</span>
          <div className="ml-auto"><div className={`w-9 h-5 rounded-full p-0.5 ${visible[w.id] ? "bg-primary" : "bg-muted-foreground/30"}`}><div className={`w-4 h-4 rounded-full transition-transform ${visible[w.id] ? "translate-x-4 bg-primary-foreground" : "translate-x-0 bg-paper"}`}/></div></div>
        </button>
        );
      })}</ModalBody>
      <ModalFooter start={<Button variant="ghost" onClick={onReset}>Reset to defaults</Button>}>
        <Button variant="primary" onClick={onClose}>Done</Button>
      </ModalFooter>
    </Modal>
  );
}
