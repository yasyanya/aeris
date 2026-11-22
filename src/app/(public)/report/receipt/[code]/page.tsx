import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { AlertTriangle, CheckCircle2, ExternalLink, Wind } from "lucide-react";
import { reportByReceipt } from "@/lib/data";
import { normalizeReceipt } from "@/lib/receipt";
import { TCEQ_COMPLAINT_URL } from "@/lib/constants";
import { ReportCard } from "@/components/ReportTimeline";
import { CopyButton } from "@/components/CopyButton";

export const metadata = { title: "Report received" };

export default async function ReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeReceipt(decodeURIComponent((await params).code));
  const r = code ? reportByReceipt(code) : null;
  if (!r) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const trackUrl = `${origin}/my-reports?code=${r.receiptCode}`;
  const qr = await QRCode.toDataURL(trackUrl, { margin: 1, width: 220, color: { dark: "#111418", light: "#ffffff" } });
  const weatherOk = r.weather.status === "ok";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="card grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 h-8 text-sm font-medium text-primary">
            <CheckCircle2 className="size-4" /> Report saved
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Thank you. Your receipt code is</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-3xl sm:text-4xl font-semibold tracking-wider">{r.receiptCode}</span>
            <CopyButton text={r.receiptCode} />
          </div>
          <p className="mt-3 max-w-xl text-sm text-ink-2">
            Keep this code to follow your report in <strong>My reports</strong>. It is the only way to look up an anonymous report,
            so save it or scan the QR code.
          </p>
          <div
            className={`mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${weatherOk ? "bg-surface-2" : "bg-[#fff4cc] text-[#6b5000] dark:bg-[#332a0a] dark:text-[#ffd966]"}`}
          >
            {weatherOk ? <Wind className="mt-0.5 size-4 text-wind" /> : <AlertTriangle className="mt-0.5 size-4" />}
            <p>
              {weatherOk
                ? "Estimated wind and weather for your observation time were attached."
                : "Weather is temporarily unavailable. Your report is saved, and wind data will be attached automatically when the service responds."}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/my-reports?code=${r.receiptCode}`} className="btn btn-primary">
              Track this report
            </Link>
            <Link href="/map" className="btn btn-ghost">
              See the community map
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code linking to report ${r.receiptCode}`} className="size-44 rounded-2xl border border-line p-2 bg-white" />
          <span className="text-[12px] text-ink-3">Scan to track</span>
        </div>
      </div>

      <div className="mt-5">
        <ReportCard r={r} />
      </div>

      <div className="mt-5 card p-5 sm:p-6 text-sm text-ink-2 leading-relaxed">
        <p className="font-medium text-ink">Need to file a formal complaint?</p>
        <p className="mt-1">
          Aeris helps NTMWD respond and spot patterns, but it is not the state&apos;s official complaint system. Under TCEQ rules, a
          nuisance determination needs a complaint filed with the regulator.{" "}
          <a href={TCEQ_COMPLAINT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary font-medium">
            File with TCEQ <ExternalLink className="size-3.5" />
          </a>
        </p>
      </div>
    </main>
  );
}
