"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addTimeline, runScreening } from "@/lib/reports-core";
import { ensureWeather } from "@/lib/data";
import { fromLocalInput } from "@/lib/format";
import { statusLabel } from "@/lib/constants";

const PUBLIC_STATUS_MSG: Record<string, string> = {
  under_review: "A staff member is reviewing your report and its weather context.",
  investigating: "Investigation underway: patrols and facility checks are being carried out.",
  closed: "This report is closed.",
};

export async function setStatus(reportId: number, status: string) {
  const u = await requireStaff();
  if (!["received", "under_review", "investigating", "closed"].includes(status)) throw new Error("Invalid status");
  const db = getDb();
  const prev = (db.prepare("SELECT status FROM reports WHERE id=?").get(reportId) as { status: string } | undefined)?.status;
  if (!prev || prev === status) return;
  db.prepare("UPDATE reports SET status=? WHERE id=?").run(status, reportId);
  if (PUBLIC_STATUS_MSG[status]) addTimeline(db, reportId, status, PUBLIC_STATUS_MSG[status], true);
  addTimeline(db, reportId, "internal", `${u.name} changed status: ${statusLabel(prev)} → ${statusLabel(status)}`, false);
  revalidatePath(`/staff/reports/${reportId}`);
}

const entrySchema = z.object({
  kind: z.enum(["patrol", "operational", "note"]),
  observedAt: z.string().min(10),
  locationText: z.string().trim().max(200).optional(),
  odorDetected: z.enum(["yes", "no", ""]).optional(),
  intensity: z.coerce.number().int().min(0).max(5).optional(),
  character: z.string().trim().max(60).optional(),
  windText: z.string().trim().max(80).optional(),
  notes: z.string().trim().min(3, "Add a short note").max(2000),
});

export async function addEntry(reportId: number, _prev: unknown, fd: FormData) {
  const u = await requireStaff();
  const raw = Object.fromEntries(fd.entries());
  if (raw.intensity === "") delete raw.intensity;
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const db = getDb();
  db.prepare(
    `INSERT INTO investigation_entries (report_id,author_id,kind,observed_at,location_text,odor_detected,intensity,character,wind_text,notes,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    reportId,
    u.id,
    v.kind,
    fromLocalInput(v.observedAt).toISOString(),
    v.locationText || null,
    v.kind === "patrol" ? (v.odorDetected === "yes" ? 1 : v.odorDetected === "no" ? 0 : null) : null,
    v.kind === "patrol" ? (v.intensity ?? null) : null,
    v.character || null,
    v.windText || null,
    v.notes,
    new Date().toISOString(),
  );
  const status = (db.prepare("SELECT status FROM reports WHERE id=?").get(reportId) as { status: string }).status;
  if (status === "received" || status === "under_review") {
    db.prepare("UPDATE reports SET status='investigating' WHERE id=?").run(reportId);
    addTimeline(db, reportId, "investigating", PUBLIC_STATUS_MSG.investigating, true);
  }
  addTimeline(db, reportId, "internal", `${u.name} logged a ${v.kind === "patrol" ? "patrol observation" : v.kind === "operational" ? "operational check" : "note"}`, false);
  revalidatePath(`/staff/reports/${reportId}`);
  return { ok: true };
}

export async function saveDraft(reportId: number, _prev: unknown, fd: FormData) {
  const u = await requireStaff();
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 20) return { error: "Write at least a couple of sentences." };
  if (body.length > 4000) return { error: "Response is too long." };
  const db = getDb();
  const existing = db.prepare("SELECT id FROM responses WHERE report_id=? AND status='draft'").get(reportId) as { id: number } | undefined;
  if (existing) db.prepare("UPDATE responses SET body=?, author_id=?, created_at=? WHERE id=?").run(body, u.id, new Date().toISOString(), existing.id);
  else
    db.prepare("INSERT INTO responses (report_id,body,status,author_id,created_at) VALUES (?,?,?,?,?)").run(
      reportId,
      body,
      "draft",
      u.id,
      new Date().toISOString(),
    );
  addTimeline(db, reportId, "internal", `${u.name} saved a response draft for manager review`, false);
  revalidatePath(`/staff/reports/${reportId}`);
  return { ok: true, saved: true };
}

/** Managers publish a reviewed response; optionally to every report in the same event cluster. */
export async function publishResponse(reportId: number, alsoIds: number[] = []) {
  const u = await requireStaff({ manager: true });
  const db = getDb();
  const draft = db.prepare("SELECT id, body, author_id FROM responses WHERE report_id=? AND status='draft'").get(reportId) as
    | { id: number; body: string; author_id: number }
    | undefined;
  if (!draft) throw new Error("No draft to publish");
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE responses SET status='published', reviewed_by=?, published_at=? WHERE id=?").run(u.id, now, draft.id);
    const targets = [reportId, ...alsoIds.filter((id) => id !== reportId)];
    for (const id of targets) {
      if (id !== reportId)
        db.prepare("INSERT INTO responses (report_id,body,status,author_id,reviewed_by,created_at,published_at) VALUES (?,?,?,?,?,?,?)").run(
          id,
          draft.body,
          "published",
          draft.author_id,
          u.id,
          now,
          now,
        );
      db.prepare("UPDATE reports SET status='responded' WHERE id=?").run(id);
      addTimeline(db, id, "responded", "NTMWD published a response to your report.", true, now);
      addTimeline(db, id, "internal", `${u.name} reviewed and published the response`, false, now);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  revalidatePath(`/staff/reports/${reportId}`);
  revalidatePath("/staff");
}

export async function retryWeather(reportId: number) {
  await requireStaff();
  const db = getDb();
  db.prepare("UPDATE weather_snapshots SET attempts=0 WHERE report_id=? AND fetch_status<>'ok'").run(reportId);
  await ensureWeather(reportId);
  revalidatePath(`/staff/reports/${reportId}`);
}

export async function rescreen(reportId: number) {
  await requireStaff();
  runScreening(getDb(), reportId);
  revalidatePath(`/staff/reports/${reportId}`);
}

const facSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(2).max(120),
  operator: z.string().trim().max(120).optional(),
  type: z.enum(["landfill", "compost", "agriculture", "wastewater", "industrial", "other"]),
  lat: z.coerce.number().min(32.9).max(33.7),
  lon: z.coerce.number().min(-97).max(-96.1),
  is_public: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function saveFacility(_prev: unknown, fd: FormData) {
  await requireStaff({ manager: true }).catch(() => {
    throw new Error("Only managers can edit facilities.");
  });
  const parsed = facSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const v = parsed.data;
  const db = getDb();
  if (v.id)
    db.prepare("UPDATE facilities SET name=?,operator=?,type=?,lat=?,lon=?,is_public=?,notes=? WHERE id=?").run(
      v.name,
      v.operator ?? null,
      v.type,
      v.lat,
      v.lon,
      v.is_public ? 1 : 0,
      v.notes ?? null,
      v.id,
    );
  else
    db.prepare("INSERT INTO facilities (name,operator,type,lat,lon,is_public,approx,notes) VALUES (?,?,?,?,?,?,1,?)").run(
      v.name,
      v.operator ?? null,
      v.type,
      v.lat,
      v.lon,
      v.is_public ? 1 : 0,
      v.notes ?? null,
    );
  // Facility changes affect screening; recompute recent results (last 30 days).
  const ids = db.prepare("SELECT id FROM reports WHERE observed_at>=?").all(new Date(Date.now() - 30 * 86_400_000).toISOString()) as { id: number }[];
  for (const { id } of ids) runScreening(db, id);
  revalidatePath("/staff/facilities");
  return { ok: true };
}
