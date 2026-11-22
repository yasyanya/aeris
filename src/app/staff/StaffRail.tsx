"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Download, ExternalLink, HelpCircle, LayoutGrid, ListChecks, LogOut, Map } from "lucide-react";

const ITEMS = [
  { href: "/staff", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/staff/map", label: "Analysis map", icon: Map },
  { href: "/staff/reports", label: "Report queue", icon: ListChecks },
  { href: "/staff/facilities", label: "Facilities", icon: Building2 },
];

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-14 z-[2000] whitespace-nowrap rounded-md bg-s-ink px-2 py-1 text-[12px] text-s-bg opacity-0 transition group-hover:opacity-100">
      {children}
    </span>
  );
}

export function StaffRail({ user }: { user: { name: string; role: string } }) {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href));
  const cls = (on: boolean) =>
    `group relative flex size-11 items-center justify-center rounded-xl transition ${on ? "bg-s-panel-2 text-s-ink" : "text-s-ink-3 hover:text-s-ink hover:bg-s-panel"}`;
  return (
    <nav className="sticky top-0 flex h-screen w-[72px] shrink-0 flex-col items-center gap-2 border-r border-s-line bg-[#0a0c0f] py-4" aria-label="Staff">
      <span className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-s-ink-3">Staff</span>
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={cls(active(i.href, i.exact))} aria-label={i.label}>
          {active(i.href, i.exact) && <span className="absolute -left-[14px] h-6 w-[3px] rounded-r bg-s-accent" />}
          <i.icon className="size-5" strokeWidth={1.7} />
          <Tip>{i.label}</Tip>
        </Link>
      ))}
      <a href="/api/staff/export" className={cls(false)} aria-label="Export CSV">
        <Download className="size-5" strokeWidth={1.7} />
        <Tip>Export CSV for regulators</Tip>
      </a>
      <div className="mt-auto flex flex-col items-center gap-2">
        <Link href="/" className={cls(false)} aria-label="Public site">
          <ExternalLink className="size-5" strokeWidth={1.7} />
          <Tip>View public site</Tip>
        </Link>
        <Link href="/learn#screening" className={cls(false)} aria-label="Help">
          <HelpCircle className="size-5" strokeWidth={1.7} />
          <Tip>How screening works</Tip>
        </Link>
        <form action="/api/auth/logout" method="post">
          <button className={cls(false)} aria-label="Sign out">
            <LogOut className="size-5" strokeWidth={1.7} />
            <Tip>Sign out</Tip>
          </button>
        </form>
        <span
          title={`${user.name} (${user.role})`}
          className="mt-2 flex size-9 items-center justify-center rounded-full bg-s-panel-2 text-[12px] font-semibold text-s-ink-2"
        >
          {user.name
            .split(" ")
            .map((s) => s[0])
            .join("")
            .slice(0, 2)}
        </span>
      </div>
    </nav>
  );
}
