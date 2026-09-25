import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Faqja nuk u gjet
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Adresa që kërkove nuk ekziston ose nuk ke akses në të.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6">
          Kthehu te paneli
        </Link>
      </div>
    </main>
  );
}
