import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type SessionOptions } from "iron-session";
import bcrypt from "bcryptjs";
import { getDb } from "./db";

export type Role = "resident" | "staff" | "manager";
export type SessionData = { userId?: number; role?: Role; name?: string };

const DEV_SECRET = "aeris-dev-only-secret-change-me-in-production-0123456789";
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production")
  console.warn("[aeris] SESSION_SECRET is not set; using an insecure development secret.");

const options: SessionOptions = {
  password: process.env.SESSION_SECRET ?? DEV_SECRET,
  cookieName: "aeris_session",
  cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8 },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), options);
}

export async function currentUser() {
  const s = await getSession();
  if (!s.userId) return null;
  return { id: s.userId, role: s.role!, name: s.name! };
}

export async function login(email: string, password: string) {
  const u = getDb().prepare("SELECT id,name,role,password_hash FROM users WHERE email=?").get(email.trim().toLowerCase()) as
    | { id: number; name: string; role: Role; password_hash: string }
    | undefined;
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return null;
  const s = await getSession();
  s.userId = u.id;
  s.role = u.role;
  s.name = u.name;
  await s.save();
  return u;
}

export async function logout() {
  (await getSession()).destroy();
}

export const isStaff = (r?: Role) => r === "staff" || r === "manager";

/** Use at the top of staff pages and in every staff server action. */
export async function requireStaff(opts: { manager?: boolean } = {}) {
  const u = await currentUser();
  if (!u || !isStaff(u.role)) redirect("/login?next=/staff");
  if (opts.manager && u.role !== "manager") throw new Error("Only managers can do this.");
  return u;
}
