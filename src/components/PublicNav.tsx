"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Map, Plus, ReceiptText, ShieldCheck } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/map", label: "Map", icon: Map },
  { href: "/my-reports", label: "My reports", icon: ReceiptText },
  { href: "/learn", label: "Learn", icon: BookOpen },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function TopNav({ user }: { user: { name: string; role: string } | null }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-[1100] hidden md:block border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="text-[17px] font-semibold tracking-tight">
          Aeris
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 h-9 inline-flex items-center text-sm transition ${
                isActive(path, l.href) ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && (user.role === "staff" || user.role === "manager") && (
            <Link href="/staff" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              <ShieldCheck className="size-4" /> Staff console
            </Link>
          )}
          {user ? (
            <form action="/api/auth/logout" method="post" className="hidden sm:block">
              <button className="text-sm text-ink-2 hover:text-ink px-2">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="hidden sm:inline text-sm text-ink-2 hover:text-ink px-2">
              Sign in
            </Link>
          )}
          <Link href="/report" className="btn btn-primary btn-sm hidden md:inline-flex">
            <Plus className="size-4" /> Report an odor
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomTabs() {
  const path = usePathname();
  const item = (href: string, label: string, Icon: typeof Home) => (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 pt-2 text-[11px] ${isActive(path, href) ? "text-primary" : "text-white/65"}`}
    >
      <Icon className="size-5" strokeWidth={1.8} />
      {label}
    </Link>
  );
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1100] flex h-[68px] items-start bg-navy pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main"
    >
      {item("/", "Home", Home)}
      {item("/map", "Map", Map)}
      <Link href="/report" className="flex flex-1 flex-col items-center -mt-4" aria-label="Report an odor">
        <span className="flex size-13 items-center justify-center rounded-full bg-lime text-navy shadow-lg ring-4 ring-navy">
          <Plus className="size-6" strokeWidth={2.4} />
        </span>
        <span className="mt-0.5 text-[11px] text-white/85">Report</span>
      </Link>
      {item("/my-reports", "Reports", ReceiptText)}
      {item("/learn", "Learn", BookOpen)}
    </nav>
  );
}
