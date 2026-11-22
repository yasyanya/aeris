import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/seed";

export const metadata = { title: "Sign in" };

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!rateLimit(`login:${await clientIp()}`, 20, 10 * 60_000).ok) redirect("/login?error=rate");
  const u = await login(email, password);
  if (!u) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  redirect(safeNext || (u.role === "resident" ? "/my-reports" : "/staff"));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
          ← Back to Aeris
        </Link>
        <div className="card mt-6 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-ink-3">Residents can also report without an account.</p>
          <form action={signIn} className="mt-6 space-y-3">
            <input type="hidden" name="next" value={next ?? ""} />
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input id="email" name="email" type="email" required className="input mt-1.5" autoComplete="username" />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input id="password" name="password" type="password" required className="input mt-1.5" autoComplete="current-password" />
            </div>
            {error && (
              <p className="text-sm text-danger">{error === "rate" ? "Too many attempts. Wait a few minutes." : "Email or password is incorrect."}</p>
            )}
            <button className="btn btn-primary w-full">Sign in</button>
          </form>
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-line p-4 text-[13px] text-ink-2">
          <p className="font-medium text-ink">Prototype demo accounts</p>
          <p className="mt-1">
            Password for all: <code className="font-mono">{DEMO_PASSWORD}</code>
          </p>
          <ul className="mt-2 space-y-1 font-mono text-[12px]">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                <span className="inline-block w-20 text-ink-3">{u.role}</span>
                {u.email}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
