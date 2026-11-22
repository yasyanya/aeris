"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addTimeline } from "@/lib/reports-core";

// Staff and managers only need three actions:
//   1. add an investigation note   2. write a response draft   3. (manager) publish it.
// Status changes follow automatically from these steps.

const noteSchema = z.object({
  notes: z.string().trim().min(3, "Write a short note").max(2000),
  odorDetected: z.enum(["yes", "no", ""]).optional(),
});

export async function addNote(reportId: number, _prev: unknown, fd: FormData) {
  const u = await requireStaff();
  const parsed = noteSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { notes, odorDetected } = parsed.data;
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO investigation_entries (report_id,author_id,kind,observed_at,odor_detected,notes,created_at) VALUES (?,?,?,?,?,?,?)`,
  ).run(reportId, u.id, odorDetected ? "patrol" : "note", now, odorDetected === "yes" ? 1 : odorDetected === "no" ? 0 : null, notes, now);
  const { status } = db.prepare("SELECT status FROM reports WHERE id=?").get(reportId) as { status: string };
  if (status === "received" || status === "under_review") {
    db.prepare("UPDATE reports SET status='investigating' WHERE id=?").run(reportId);
    addTimeline(db, reportId, "investigating", "Investigation underway: staff are checking the area and facility operations.", true);
  }
  addTimeline(db, reportId, "internal", `${u.name} added a note`, false);
  revalidatePath(`/staff/reports/${reportId}`);
  return { ok: true };
}

export async function saveDraft(reportId: number, _prev: unknown, fd: FormData) {
  const u = await requireStaff();
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 20) return { error: "Write at least a couple of sentences." };
  if (body.length > 4000) return { error: "This response is too long." };
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT id FROM responses WHERE report_id=? AND status='draft'").get(reportId) as { id: number } | undefined;
  if (existing) db.prepare("UPDATE responses SET body=?, author_id=?, created_at=? WHERE id=?").run(body, u.id, now, existing.id);
  else db.prepare("INSERT INTO responses (report_id,body,status,author_id,created_at) VALUES (?,?,?,?,?)").run(reportId, body, "draft", u.id, now);
  addTimeline(db, reportId, "internal", `${u.name} saved a response draft`, false);
  revalidatePath(`/staff/reports/${reportId}`);
  return { ok: true };
}

/** Managers approve the draft; the resident then sees it in My reports. */
export async function publishResponse(reportId: number) {
  const u = await requireStaff({ manager: true });
  const db = getDb();
  const draft = db.prepare("SELECT id FROM responses WHERE report_id=? AND status='draft'").get(reportId) as { id: number } | undefined;
  if (!draft) throw new Error("Save a draft first.");
  const now = new Date().toISOString();
  db.prepare("UPDATE responses SET status='published', reviewed_by=?, published_at=? WHERE id=?").run(u.id, now, draft.id);
  db.prepare("UPDATE reports SET status='responded' WHERE id=?").run(reportId);
  addTimeline(db, reportId, "responded", "NTMWD published a response to your report.", true, now);
  addTimeline(db, reportId, "internal", `${u.name} approved and published the response`, false, now);
  revalidatePath(`/staff/reports/${reportId}`);
  revalidatePath("/staff");
}
