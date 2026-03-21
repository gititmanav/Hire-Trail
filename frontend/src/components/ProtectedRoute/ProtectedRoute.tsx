import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { User } from "../../types";

export default function ProtectedRoute({ user, children }: { user: User | null; children: ReactNode }) {
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
