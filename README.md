# Aeris: community odor reporting prototype (Melissa, TX)

Aeris is a free, working prototype that does a few things:

- Residents can report odors.
- Everyone can see a privacy-safe community map with wind information.
- Every report automatically gets weather attached.
- NTMWD staff can screen possible sources, log investigations and publish reviewed responses.

It is a lightweight, no-cost alternative to commercial platforms such as Envirosuite EVS Omnis. The design is informed by Smell Pittsburgh (Hsu et al., 2020) and the TCEQ odor complaint investigation procedures.

Everything runs on free services. Nothing needs an API key.

| Concern | Choice |
| --- | --- |
| App | Next.js 16 (App Router, TypeScript), Tailwind CSS v4 |
| Database | SQLite through Node's built-in `node:sqlite`, stored in one file at `data/aeris.db`. No native build is needed. |
| Map | Leaflet + OpenStreetMap tiles, styled grey with CSS. Esri World Imagery is used for the staff satellite view. |
| Weather | [Open-Meteo](https://open-meteo.com) model data, licensed CC BY 4.0 |
| Geocoding | OpenStreetMap Nominatim, called through a server proxy |
| Auth | Encrypted cookie sessions (iron-session) with bcrypt-hashed demo accounts |

## Run it

You need Node.js 22.13 or newer. It was tested on Node 26.

```bash
npm install
npm run seed     # optional: resets the DB with demo data and real Open-Meteo weather for the last 31 days
npm run dev      # http://localhost:3000
npm test         # unit tests for screening, geo math and privacy aggregation
```

If you skip `npm run seed`, the app creates and seeds the database on first request using synthetic demo weather. To seed without network access, run `npm run seed -- --offline`.

### Deploy a free public demo (Render)

The repository includes a [`render.yaml`](render.yaml) blueprint.

1. Sign in at [render.com](https://render.com) with GitHub. No card is needed for the free tier.
2. Choose **New → Blueprint** and pick this repository.
3. Click **Apply**.

Render builds the app and gives it a public `https://aeris-….onrender.com` URL that you can open on any phone.

Free instances behave like this:

- They sleep after about 15 minutes without traffic, and the first visit after that takes about 30–60 seconds.
- The demo database is **re-seeded on every start**, so reports submitted on the demo are not kept long-term.

### Demo accounts

The password for all three is `demo1234`.

| Role | Email | Sees |
| --- | --- | --- |
| Resident | `resident@demo.aeris` | Their own reports under **My reports** |
| Staff investigator | `staff@demo.aeris` | Staff console. Can log patrols and checks and draft responses. |
| Manager | `manager@demo.aeris` | Everything staff sees, plus publishing responses and editing facilities |

Residents can also report anonymously. They get a receipt code such as `MEL-7K3Q-92XH` to track the report.

## What's included

### Public (resident) side: light, calm, plain language

- **Report an odor** (`/report`) is a 4-step wizard:
  1. **Where:** device GPS, address search, or a map pin.
  2. **When:** the time and duration (using TCEQ duration buckets), and whether the odor is still happening.
  3. **What:** intensity 0–5 (mapped to TCEQ VL/L/M/S/VS), odor character, optional effects, and an optional suspected source.
  4. **Review:** an editable summary with every field linking back to its step, plus optional contact details with a consent box.
- **On submit,** the report is saved first. Weather is attached afterwards. If Open-Meteo fails, the report is still saved, the receipt says weather is pending, and the weather is retried later.
- **Receipt** (`/report/receipt/[code]`) shows the receipt code, a QR code, the weather status, the timeline, and a link to file formally with TCEQ.
- **Community map** (`/map`):
  - Reports are grouped into hexagons about 500 m across.
  - Each hexagon's colour is the **median intensity** of its reports.
  - Public facilities are shown with approximate locations.
  - A timestamped regional wind arrow is shown.
  - An optional "air-movement estimate" shows a dashed forward path from each facility for the next 2 hours, based on forecast wind.
  - Date ranges are 24 h, 7 days or 30 days.
  - A Smell Pittsburgh-style daily strip shows each day, with playback.
  - Tapping an area shows its report count, median intensity, and eligible odor categories.
- **My reports** (`/my-reports`): look up a report by receipt code, or sign in to list your own reports. Each report shows a progress rail, a public timeline, and the published response.
- **Learn** (`/learn`) has five short explainers (map, wind, screening, process, privacy), an FAQ, and resource cards linking to NTMWD and TCEQ pages.

### Staff side: dark, analytical, inspired by EVS

- **Dashboard** (`/staff`):
  - An "Odor event detected" card, triggered when there are 3 or more reports rated 3+ within 60 minutes and 2 km of each other. This is the crowd-triggered alert idea from Smell Pittsburgh.
  - KPIs.
  - A "needs attention" table.
  - An intensity histogram.
  - Drafts waiting for a manager.
- **Analysis map** (`/staff/map`):
  - Exact report points on satellite or dark basemaps.
  - A 5×5 modelled wind field.
  - Clicking a report shows its **back-trajectory**: a white path, a violet uncertainty band, and dots every 20 minutes.
  - It also shows the **upwind cone**.
  - **Shift-click** several reports to see which facilities they have in common.
  - A playback scrubber shows a rolling 6-hour window.
- **Report detail** (`/staff/reports/[id]`) shows:
  - The map.
  - The screening result with reasons, assumptions and missing information.
  - Hourly weather context (wind, pressure, mixing height).
  - Contact details, only if the resident consented.
  - A TCEQ-style patrol and operational-check log.
  - Status controls.
  - The response workflow: staff draft, a manager approves and publishes. The manager can also publish to related nearby reports.
- **Facilities** (`/staff/facilities`) lets managers edit names, coordinates and public visibility. Saving re-runs screening for the last 30 days.
- **CSV export** (`/api/staff/export`) produces a regulator-friendly file with reports, weather and screening. It guards against spreadsheet formula injection.

## Source screening: how it works

The screening logic is in `src/lib/screening.ts` and covered by `src/lib/screening.test.ts`. It uses deterministic, explainable rules, with no machine learning.

1. **Wind at the observation time.** Hourly Open-Meteo values are interpolated as u/v vectors, so 350° and 10° average to 0° rather than 180°.
2. **Inconclusive cases.** The result is *inconclusive* when:
   - Weather is missing.
   - Wind is under 2 mph. The NWS treats about 2 knots as calm.
   - Wind direction swung 60° or more in the previous 2 hours. This is METAR's "variable" threshold.

   Calm results still list facilities within 3 km, but only as "nearby".
3. **Upwind cone.** A facility is a candidate if the bearing from the observer to the facility is within the tolerance of the direction the wind blows *from*, and the facility is within 8 km. The tolerance is ±22.5° normally, widened to ±35° when wind is light (under 5 mph) or shifting.
4. **Back-trajectory.** The air is stepped backwards for 3 hours in 10-minute steps, using the interpolated hourly wind. Facilities within 750 m of that path are flagged. This is the simple piecewise approach several state agencies use for odor complaints, and it is not a full HYSPLIT model.
5. **Output.** The result is a verdict (`candidates`, `none_fit` or `inconclusive`) with a qualitative level for each candidate ("stronger" or "possible"). It never gives a percentage. It also includes:
   - The reasons for each candidate.
   - A note when several facilities lie within 15° of each other as seen from the observer, because wind alone can't tell them apart.
   - The assumptions used.
   - Any missing information.
6. **Corroboration.** Across several selected reports, the app counts how many reports' screens list each facility.

The public side never shows source attribution. Staff see it as a *screening aid*. Patrols confirm what is actually happening, in line with TCEQ's requirement for field verification.

## Privacy and data protection

- Exact coordinates, notes and contact details are only available through staff-authenticated routes.
- The public `/api/map/aggregate` endpoint returns only hexagon cells with **at least 3 reports** (k-anonymity). It also returns only odor categories that **at least 2 reports** in the cell share. It never returns raw points or free text.
- Contact details are stored only when the resident explicitly consents.
- Receipt codes are random: 8 symbols, about 39 bits. Receipt lookups, report submissions, logins and geocoding are all rate-limited.
- Address search goes through a server proxy, so residents' IP addresses are not sent to OpenStreetMap.
- There are no third-party analytics.

## Should there be an AI chatbot?

**No, not in v1.** It was evaluated and left out deliberately, for these reasons:

- **Liability.** A chatbot could confidently state a health conclusion ("it's safe") or a cause ("it's the landfill"). Neither can be supported from these data, and either would undermine trust and possibly NTMWD's legal position.
- **Cost.** It needs a paid LLM API, which conflicts with the "free" requirement.
- **Little benefit.** The questions residents actually ask are covered by short explainers, the FAQ and the official resource cards.

**If you add one later,** keep it narrow:

- Answer only from the Learn and FAQ content and the NTMWD pages (retrieval-grounded).
- Refuse health and blame questions and point to official contacts instead.
- Keep it behind a feature flag, and log conversations for review.

## Project layout

```
src/lib/            domain logic: geo math, wind interpolation, Open-Meteo client, screening, aggregation, DB, auth, seed
src/app/(public)/   home, report wizard + receipt, community map, my reports, learn
src/app/staff/      dashboard, analysis map, queue, report detail, facilities, server actions
src/app/api/        reports (POST), map aggregate, geocode proxy, staff windfield/screening/export, cron weather retry
src/components/     shared UI and Leaflet map components
design-refs/        design inspiration screenshots (local only, not committed)
scripts/seed.ts     reset and seed the database
```

## Before production

- **Facility coordinates.** The seeded coordinates are **approximate**. Sister Grove could be off by 1–3 km. Verify them in the Facilities page.
- **Weather terms.** Open-Meteo's free tier is for non-commercial use. A public agency deployment should check the terms or use a paid plan. Also attribute the data, as the app already does in its footer.
- **Map tiles.** OpenStreetMap's public tiles are for light use. For production, use a tile provider or self-host tiles (for example, Protomaps PMTiles).
- **Secrets.** Set `SESSION_SECRET` (32+ characters). Set `CRON_SECRET` and schedule `GET /api/cron/retry-weather?key=…` every 15 minutes.
- **Real accounts.** Replace the demo accounts with real staff accounts, for example via SSO.
- **Database.** SQLite suits a single server. On serverless hosting, move to hosted SQLite (Turso) or Postgres.
- **Retention and records.** Decide a data-retention period. Check obligations under the Texas Public Information Act for stored reports.
- **Future ideas:**
  - Spanish localization.
  - Push or email notifications when a response is published.
  - On-site H₂S sensors.
  - A local weather station to replace modelled wind.
  - A predictive "odor risk" forecast like Smell Pittsburgh's.
