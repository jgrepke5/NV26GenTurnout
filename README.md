# 2026 Nevada General Turnout Tracker

Journalism-style reporting site for Nevada’s 2026 **general** election turnout, built from NVSOS [VIVID](https://www.nvsos.gov/elections/election-information/vivid-project) File 6 ballot-status extracts.

**Pages:** Statewide, County, Congressional, Legislative, Commission.

**Cast ballot rule:** `BALLOT_STATUS = Accepted` and `VOTE_METHOD` filled. Party from `VOTER_REG_PARTY`.

**R/D advantage:** Republican ballots minus Democrat ballots (`R+#` / `D+#`), plus advantage % of all ballots cast. Historic **2022** and **2024** sub-headers appear for statewide, SD8, SD9, SD12, and Clark Commission District F only.

## Run locally

1. Place the latest File 6 zip at `data/raw/File6.zip` (or any `*File6*.zip` / CSV in `data/raw/`).
2. Ensure `data/NV_AB_EV_ByDay_2024_2022.xlsx` is present (historic series).

```bash
npm install
npm run import-historic   # writes data/historic-rd-advantage.json
npm run sync              # aggregates File 6 → data/cache.json
npm run dev               # http://localhost:3000
```

`npm run build` runs historic import + sync, then Next.js with the on-disk cache.

## Deploy (Vercel)

1. Framework: Next.js; Build Command: `npm run build`; Output Directory: empty.
2. Commit `data/historic-rd-advantage.json` and a fresh `data/cache.json` (aggregates only — do **not** commit raw File 6).
3. Set `CRON_SECRET`. Optional: `UPDATE_FEED_URL`.
4. Cron hits `/api/cron` — if NVSOS Incapsula blocks the fetch, drop File 6 into `data/raw/` in CI or re-run sync locally and redeploy.

## Manual refresh

```bash
npm run sync
```

Or `POST /api/sync?secret=YOUR_CRON_SECRET`.
