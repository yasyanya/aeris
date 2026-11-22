import Link from "next/link";
import { Search } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ensureWeather, reportByReceipt, reportsForUser } from "@/lib/data";
import { normalizeReceipt } from "@/lib/receipt";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { ReportCard } from "@/components/ReportTimeline";

export const metadata = { title: "My reports" };
export const dynamic = "force-dynamic";

export default async function MyReports({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code: raw } = await searchParams;
  const user = await currentUser();
  let lookup: ReturnType<typeof reportByReceipt> = null;
  let lookupError: string | null = null;
  if (raw) {
    const code = normalizeReceipt(raw);
    const rl = rateLimit(`receipt:${await clientIp()}`, 30, 10 * 60_000);
    if (!rl.ok) lookupError = "Too many lookups. Please wait a few minutes and try again.";
    else if (!code) lookupError = "That doesn't look like a receipt code. It should look like MEL-7K3Q-92XH.";
    else {
      lookup = reportByReceipt(code);
      if (!lookup) lookupError = "No report found with that code. Check for typos.";
      else if (lookup.weather.status !== "ok") {
        await ensureWeather(lookup.id); // opportunistic retry of failed weather
        lookup = reportByReceipt(code);
      }
    }
  }
  const mine = user?.role === "resident" ? reportsForUser(user.id) : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
      <p className="eyebrow">Track your reports</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">My reports</h1>

      <form className="card mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-end" action="/my-reports">
        <div className="flex-1">
          <label htmlFor="code" className="label">
            Look up a report by receipt code
          </label>
          <input
            id="code"
            name="code"
            defaultValue={raw ?? ""}
            placeholder="MEL-XXXX-XXXX"
            className="input mt-1.5 font-mono uppercase tracking-wider"
            autoComplete="off"
          />
        </div>
        <button className="btn btn-primary">
          <Search className="size-4" /> Find report
        </button>
      </form>
      {lookupError && <p className="mt-3 text-sm text-danger">{lookupError}</p>}
      {lookup && (
        <div className="mt-5">
          <ReportCard r={lookup} />
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Reports on your account</h2>
        {!user && (
          <p className="mt-2 text-sm text-ink-2">
            You can report without an account and use your receipt code above.{" "}
            <Link href="/login?next=/my-reports" className="text-primary font-medium">
              Sign in
            </Link>{" "}
            to see every report you&apos;ve made in one place.
          </p>
        )}
        {user && (
          <form action="/api/auth/logout" method="post" className="mt-2 md:hidden">
            <button className="text-sm text-primary font-medium">Sign out ({user.name})</button>
          </form>
        )}
        {user && user.role !== "resident" && <p className="mt-2 text-sm text-ink-2">You&apos;re signed in as staff. Staff accounts don&apos;t file reports.</p>}
        {user?.role === "resident" && mine.length === 0 && <p className="mt-2 text-sm text-ink-2">No reports yet.</p>}
        <div className="mt-4 space-y-5">
          {mine.map((r) => (
            <ReportCard key={r.id} r={r} />
          ))}
        </div>
      </section>
    </main>
  );
}
