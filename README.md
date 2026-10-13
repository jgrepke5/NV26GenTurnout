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

`npm run build` imports historic series and builds from committed `data/cache.json` (File 6 is too large for Vercel). Refresh data locally with `npm run sync`, commit the updated `data/cache.json`, then push.

## Deploy (Vercel)

1. Framework: Next.js; Build Command: `npm run build`; Output Directory: empty.
2. Keep `data/historic-rd-advantage.json` and `data/cache.json` committed (do **not** commit raw File 6).
3. Set `CRON_SECRET` if you use the sync API.
4. After each new VIVID File 6: run `npm run sync` locally, commit `data/cache.json`, push to deploy.

## Manual refresh

```bash
npm run sync
```

Or `POST /api/sync?secret=YOUR_CRON_SECRET`.
