import { logout } from "@/lib/auth";

export async function POST() {
  await logout();
  // Relative redirect: behind a proxy (e.g. Render) the request URL is the internal
  // address (localhost:10000), which the browser can't reach.
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
