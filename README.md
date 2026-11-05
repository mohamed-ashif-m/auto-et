# Auto Et — private expense tracker (neo-brutalist edition)

Capacitor + React + TypeScript front end, native Android (Java, Room + SQLCipher) back end.
Payments are detected automatically from bank / UPI SMS notifications and stored in an
encrypted on-device database. Nothing leaves the phone.

## Features

- **Auto-tracking** from Google Messages, Samsung Messages and stock SMS apps (notification listener),
  with smarter payee parsing, OTP filtering and automatic categorisation.
- **Manual entry** with amount, payee, category, date (backdating) and note. Edit and delete any transaction.
- **Home** dashboard: balance or "left to spend", income/spent, top spending, recent activity, month switcher.
- **History**: search, type + category filters, grouped by day with daily net.
- **Stats**: week / month / year / all-time; spending-or-income trend bars, category donut,
  top categories / merchants / biggest expenses, daily average, priciest day, change vs last period.
- **Budget**: monthly limit, per-category limits, "safe to spend per day", savings-goal tracker.
- **Customisation**: name, light/dark/auto theme, 6 accent colours, corner style, shadow depth,
  hide-amounts mode, month start day (pay-day cycles), custom categories (emoji + colour),
  smart rules (keyword → category), CSV export, delete-all.

## Run it

```bash
npm install
npm run dev            # browser preview with demo data (localStorage stand-in for the native plugin)

npm run build
npx cap sync android
npx cap open android   # run on a device/emulator from Android Studio
```

Then on the phone: **Settings → SMS auto-tracking → Open notification access** and enable *Auto Et*.

Fonts (Archivo Black + Space Grotesk) are bundled via `@fontsource`, so the app makes no network
requests. If you'd rather not add them, delete `src/fonts.ts` and its import in `src/main.tsx`;
the CSS falls back to system fonts.

## What changed in the native layer

| File | Change |
| --- | --- |
| `AutoEtDatabase.java` | DB v3 + `MIGRATION_2_3` (adds `note` column and `kv_store` table). Existing data is preserved. |
| `Transaction.java`, `KvEntry.java`, `KvDao.java`, `TransactionDao.java` | `note`, key/value settings store, update / delete / reassign / wipe queries. |
| `TransactionPlugin.java` | New: `updateTransaction`, `deleteTransaction`, `reassignCategory`, `clearAllTransactions`, `getValue/setValue`, `isNotificationAccessEnabled`, `openNotificationAccessSettings`, `exportCsv`. Categories are no longer limited to a fixed list. |
| `ExpenseNotificationListener.java` | More SMS apps, better merchant extraction, OTP filter, auto-categorisation. |
| `CategoryRules.java` | New: user rules first, then a built-in keyword list (Swiggy → Food, Uber → Transport, …). |

## Project layout (web)

```
src/
  lib/        types, defaults (palette + categories), formatting, period maths, analytics
  store/      AppStore.tsx — transactions, settings, categories, rules
  plugins/    native bridge + browser fallback
  components/ ui kit, charts (SVG donut + bars), transaction rows and sheets
  screens/    Home, History, Stats, Budget, Settings
  styles/     tokens.css (design tokens), base.css, components.css, screens.css
```

Design tokens (colours, border width, shadow offset, radius) live in `src/styles/tokens.css`.
