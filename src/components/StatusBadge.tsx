import { STATUS_LABELS, STATUS_STYLES } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
