import { Badge } from "../ui/badge";

interface PeasStatusBadgeProps {
  status: string;
}

export function PeasStatusBadge({ status }: PeasStatusBadgeProps) {
  const normalized = status.toLowerCase();
  const tone = normalized === "approved" ? "green" : normalized === "rejected" ? "rose" : "gold";
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return <Badge tone={tone}>{label}</Badge>;
}
