import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "muted" | "accent";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = "muted", children }: BadgeProps) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

export const StatusPill = Badge;