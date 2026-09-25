import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { ROLE_LABELS } from "@/lib/format";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Paneli", icon: "◧" },
    { href: "/shpenzime", label: "Shpenzime", icon: "▤" },
  ];
  if (user.role === "ADMIN" || user.role === "FINANCE") {
    items.push({ href: "/kategori", label: "Kategori", icon: "⊞" });
    items.push({ href: "/furnitore", label: "Furnitorë", icon: "⌂" });
  }
  if (user.role === "ADMIN") {
    items.push({ href: "/perdorues", label: "Përdorues", icon: "◉" });
  }

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 bg-slate-900 px-4 py-5 lg:w-64">
        <Link href="/dashboard" className="flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            IF
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-white">IntexFin</span>
            <span className="text-xs text-slate-400">Intex Courier</span>
          </span>
        </Link>

        <div className="flex-1">
          <NavLinks items={items} />
        </div>

        <div className="border-t border-slate-800 pt-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-100">
              {initials || "?"}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-white">
                {user.name}
              </span>
              <span className="block truncate text-xs text-slate-400">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Dil nga sistemi
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  );
}
