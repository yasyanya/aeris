import { z } from "zod";
import { CHARACTER_KEYS, DURATION_KEYS, MAP_BOUNDS, SYMPTOM_KEYS } from "./constants";

const PAD = 0.12; // allow reports a little outside the core map area
const [[S, W], [N, E]] = MAP_BOUNDS;

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const reportInput = z
  .object({
    lat: z.number().min(S - PAD).max(N + PAD),
    lon: z.number().min(W - PAD).max(E + PAD),
    locationMethod: z.enum(["device", "pin", "search"]),
    observedAt: z.string().datetime(),
    intensity: z.number().int().min(0).max(5),
    characters: z.array(z.enum(CHARACTER_KEYS)).min(1, "Choose at least one description").max(5),
    characterOther: optText(120),
    duration: z.enum(DURATION_KEYS).default("unknown"),
    ongoing: z.boolean(),
    symptoms: z.array(z.enum(SYMPTOM_KEYS)).max(SYMPTOM_KEYS.length),
    suspectedSource: optText(120),
    notes: optText(1000),
    consentContact: z.boolean(),
    contactName: optText(80),
    contactPhone: optText(30),
    contactEmail: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => v == null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email"),
  })
  .superRefine((v, ctx) => {
    const t = Date.parse(v.observedAt);
    if (t > Date.now() + 10 * 60_000) ctx.addIssue({ code: "custom", path: ["observedAt"], message: "Time can't be in the future" });
    if (t < Date.now() - 7 * 86_400_000)
      ctx.addIssue({ code: "custom", path: ["observedAt"], message: "Reports can cover up to 7 days ago" });
    if (v.consentContact && !v.contactEmail && !v.contactPhone)
      ctx.addIssue({ code: "custom", path: ["contactEmail"], message: "Add an email or phone so staff can reach you" });
  });

export type ReportInput = z.infer<typeof reportInput>;
