import type { ReactNode } from "react";
import { Badge } from "../../../components/ui";
import type { BadgeTone } from "../../../components/ui/Badge";

interface LeaveTypeBadgeProps {
  leaveTypeKey: string;
  children: ReactNode;
}

const leaveTypeTones: Record<string, BadgeTone> = {
  annual: "accent",
  casual: "warning",
  sick: "success",
  unpaid: "muted",
};

export function LeaveTypeBadge({ leaveTypeKey, children }: LeaveTypeBadgeProps) {
  const tone = leaveTypeTones[leaveTypeKey] ?? "muted";
  return <Badge tone={tone}>{children}</Badge>;
}
