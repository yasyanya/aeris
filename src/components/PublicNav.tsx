"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Map, Plus, ReceiptText, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "./theme";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/map", label: "Map" },
  { href: "/my-reports", label: "My reports" },
  { href: "/learn", label: "Learn" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function TopNav({ user }: { user: { name: string; role: string } | null }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-[1100] hidden border-b border-line/70 bg-canvas/85 backdrop-blur-md md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        <Link href="/" className="text-[17px] font-semibold tracking-tight">
          Aeris
        </Link>
        <nav className="ml-6 flex items-center gap-1" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`inline-flex h-9 items-center rounded-full px-4 text-sm transition ${
                isActive(path, l.href) ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user && (user.role === "staff" || user.role === "manager") && (
            <Link href="/staff" className="btn btn-ghost btn-sm">
              <ShieldCheck className="size-4" /> Staff
            </Link>
          )}
          {user ? (
            <form action="/api/auth/logout" method="post">
              <button className="px-2 text-sm text-ink-2 hover:text-ink">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="px-2 text-sm text-ink-2 hover:text-ink">
              Sign in
            </Link>
          )}
          <Link href="/report" className="btn btn-primary btn-sm">
            <Plus className="size-4" /> Report an odor
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Phones only: a thin account bar (no logo) so sign-in is easy to find. */
export function MobileAccountBar({ user }: { user: { name: string; role: string } | null }) {
  const isStaff = user && (user.role === "staff" || user.role === "manager");
  return (
    <div className="sticky top-0 z-[1100] flex h-12 items-center justify-end gap-2 border-b border-line/70 bg-canvas/90 px-4 backdrop-blur md:hidden">
      <ThemeToggle iconOnly className="mr-auto h-8 w-8 justify-center px-0" />
      {user ? (
        <>
          {isStaff && (
            <Link href="/staff" className="btn btn-primary btn-sm h-8">
              <ShieldCheck className="size-4" /> Staff
            </Link>
          )}
          <form action="/api/auth/logout" method="post">
            <button className="btn btn-ghost btn-sm h-8">Sign out</button>
          </form>
        </>
      ) : (
        <Link href="/login" className="btn btn-primary btn-sm h-8">
          Sign in
        </Link>
      )}
    </div>
  );
}

export function BottomTabs() {
  const path = usePathname();
  const item = (href: string, label: string, Icon: typeof Home) => (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 pt-2.5 text-[11px] ${isActive(path, href) ? "font-medium text-ink" : "text-ink-3"}`}
    >
      <Icon className="size-5" strokeWidth={1.8} />
      {label}
    </Link>
  );
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1100] flex h-[68px] items-start border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main"
    >
      {item("/", "Home", Home)}
      {item("/map", "Map", Map)}
      <Link href="/report" className="-mt-4 flex flex-1 flex-col items-center" aria-label="Report an odor">
        <span className="flex size-13 items-center justify-center rounded-full bg-ink text-surface shadow-lg ring-4 ring-surface">
          <Plus className="size-6" strokeWidth={2.2} />
        </span>
        <span className="mt-0.5 text-[11px] text-ink-2">Report</span>
      </Link>
      {item("/my-reports", "Reports", ReceiptText)}
      {item("/learn", "Learn", BookOpen)}
    </nav>
  );
}
