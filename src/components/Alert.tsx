type Props = {
  kind?: "error" | "success" | "info" | "warning";
  children: React.ReactNode;
};

const STYLES: Record<string, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function Alert({ kind = "info", children }: Props) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${STYLES[kind]}`}
    >
      {children}
    </div>
  );
}
