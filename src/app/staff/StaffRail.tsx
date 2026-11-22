"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Inbox, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme";

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-14 z-[2000] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] text-surface opacity-0 transition group-hover:opacity-100">
      {children}
    </span>
  );
}

export function StaffRail({ user }: { user: { name: string; role: string } }) {
  const path = usePathname();
  const cls = (on: boolean) =>
    `group relative flex size-11 items-center justify-center rounded-xl transition ${on ? "bg-surface-2 text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink"}`;
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);
  return (
    <nav
      className="sticky top-3 hidden h-[calc(100vh-24px)] w-[72px] shrink-0 flex-col items-center gap-2 rounded-[20px] border border-line/60 bg-surface py-4 shadow-card md:flex"
      aria-label="Staff"
    >
      <span
        title={`${user.name} · ${user.role}`}
        className="mb-4 flex size-10 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink-2"
      >
        {initials}
      </span>
      <Link href="/staff" className={cls(path === "/staff" || path.startsWith("/staff/reports"))} aria-label="Reports">
        <Inbox className="size-5" strokeWidth={1.7} />
        <Tip>Reports</Tip>
      </Link>
      <Link href="/" className={cls(false)} aria-label="Public site">
        <ExternalLink className="size-5" strokeWidth={1.7} />
        <Tip>Public site</Tip>
      </Link>
      <div className="mt-auto flex flex-col items-center gap-2">
        <ThemeToggle iconOnly className="size-11 justify-center px-0" />
        <form action="/api/auth/logout" method="post">
          <button className={cls(false)} aria-label="Sign out">
            <LogOut className="size-5" strokeWidth={1.7} />
            <Tip>Sign out</Tip>
          </button>
        </form>
      </div>
    </nav>
  );
}
