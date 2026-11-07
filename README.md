# Auto Et — private expense tracker

**Auto Et** is a neo-brutalist personal finance app for Android. It reads bank and UPI
payment notifications from your SMS app, logs them automatically, and keeps every
transaction in an **encrypted on-device database**. Nothing is uploaded, synced, or sent
anywhere.

Built with a **React + TypeScript** front end, **Capacitor** as the native bridge, and a
**Java / Room / SQLCipher** Android back end.

<p align="center">
  <img src="Auto%20et%20App%20interface%201.png" alt="Auto Et app interface - screen 1" width="240" />
  <img src="Auto%20et%20App%20interface%202.png" alt="Auto Et app interface - screen 2" width="240" />
  <img src="Auto%20et%20App%20interface%203.png" alt="Auto Et app interface - screen 3" width="240" />
</p>

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
  - [Runtime data flow](#runtime-data-flow)
  - [Auto-tracking pipeline](#auto-tracking-pipeline)
  - [Categorisation priority](#categorisation-priority)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Run in the browser](#run-in-the-browser)
  - [Run on Android](#run-on-android)
  - [Enable SMS auto-tracking](#enable-sms-auto-tracking)
- [How the app works](#how-the-app-works)
  - [Screens](#screens)
  - [Periods, budgets and pay-day cycles](#periods-budgets-and-pay-day-cycles)
  - [Data model](#data-model)
  - [Storage keys](#storage-keys)
- [CSV import and export](#csv-import-and-export)
- [Native plugin API](#native-plugin-api)
- [Privacy and security](#privacy-and-security)
- [Design system](#design-system)
- [Scripts](#scripts)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)

---

## Features

### Automatic tracking

- Listens for bank / UPI payment notifications from **Google Messages**, **Samsung Messages**,
  and stock Android SMS apps.
- Parses amount, payee, income vs. expense, and posting time from notification text.
- Ignores failed, pending, declined, initiated and **OTP** messages.
- Deduplicates repeat notification callbacks with a SHA-256 fingerprint stored in the DB.
- Auto-categorises payments using built-in merchant keywords and your own **Smart rules**.
- Works even when the app is closed (the listener and budget alerts run natively).

### Manual entry

- Add an expense or income with amount, payee, category, date (including backdating) and note.
- Edit or delete any transaction.
- Grid of categories with emoji + colour; smart rules pre-fill the category as you type.

### Home dashboard

- Greeting with your name and the current month cycle.
- Hero card shows **left to spend** (if a budget is set) or **net balance this month**.
- Tap the hero card for a month-by-month **Financial Table** ledger.
- Earned / spent summary, top spending categories, recent transactions.
- Month switcher plus a full **calendar** with per-day stats.
- One-tap banner and settings shortcut when notification access is off.

### History

- Search by merchant, note or category.
- Filter by Spent / Earned and by category (only categories actually in use are shown).
- Transactions grouped by day with a daily net total.
- Incremental "Show more" pagination (60 rows per page).

### Stats

- Periods: **week, month, year, all time**, with previous / next navigation and custom ranges.
- Spent / earned / net KPI cards.
- Spending or income **bar trend** (daily buckets for weeks, weekly for months, monthly for years).
- Category **donut chart** with tap-to-highlight and a legend.
- Top categories, top merchants, and biggest individual expenses.
- Daily average, transaction count (including how many came via SMS), priciest day, and
  percentage change vs. the previous period.
- Tap any category to see **every payment** in that category for the selected range.

### Budget

- Monthly spending limit with progress meter and safe-to-spend-per-day figure.
- Per-category limits, yellow near the limit and coral when over.
- Savings goal as a percentage of this month's income.
- **Loans to pay** list with lender, optional amount, due date, note, and paid/unpaid state.
- Native low-budget notification when less than **10%** of the monthly budget remains
  (and again when the budget is exceeded).

### Customisation

- Name, light / dark / auto theme, 6 accent colours.
- Three corner styles (sharp, soft, round) and three shadow depths (flat, bold, heavy).
- Hide-amounts mode (`₹ ••••`) for shoulder-surfers.
- Custom month start day (1–28) to match your pay day.
- Built-in + custom categories with emoji and colour.
- Smart rules: keyword → category.
- CSV import and export.
- Replayable onboarding tour.
- Delete-all for transactions (settings and categories are kept).

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript ~5.9 |
| Build | Vite 8 (`@vitejs/plugin-react`) |
| Native bridge | Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`) |
| Android | Java, minSdk 24, target/compileSdk 36 |
| Database | Room 2.8.5 over SQLCipher 4.19.1 (encrypted SQLite) |
| Key management | Android Keystore (AES-256-GCM) |
| Fonts | `@fontsource/archivo-black`, `@fontsource-variable/space-grotesk` (bundled, no network) |
| Linting | ESLint 10, `typescript-eslint`, React Hooks + Refresh plugins |

The UI has **no runtime dependencies beyond React** — icons and charts are hand-built
SVG, routing is local component state, and there is no external UI or chart library.

---

## Architecture

### Runtime data flow

```text
┌──────────────────────────── Android ────────────────────────────┐
│                                                                  │
│  SMS notification                                                │
│        │                                                         │
│        ▼                                                         │
│  ExpenseNotificationListener (Java)                              │
│        │  parse amount / payee / type                            │
│        │  filter OTP + failed + duplicates                       │
│        ▼                                                         │
│  CategoryRules  ◄──── "rules" key in kv_store                    │
│        │                                                         │
│        ▼                                                         │
│  Room DAO ──► SQLCipher-encrypted auto_et.db                     │
│        ▲                                                         │
│        │                                                         │
│  TransactionPlugin (Capacitor plugin) ◄── React app              │
│        ▲                                    │                    │
│        │                             AppStore (context)          │
│        │                                    │                    │
│        └────────── settings / rules / loans ┘                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- The React layer never touches SQLite directly. All reads/writes go through the
  `TransactionPlugin` Capacitor bridge.
- In a plain browser, the bridge falls back to a **web plugin** backed by `localStorage`
  with seeded demo data, so the entire UI can be developed without an emulator.
- Settings, rules and loans are stored twice: a localStorage cache for fast startup, and
  the encrypted native key/value store as the source of truth. The native listener reads
  the `"rules"` key directly so auto-categorisation works while the UI is closed.

### Auto-tracking pipeline

1. `ExpenseNotificationListener` receives a `StatusBarNotification`.
2. Only notifications from known messaging packages are considered:
   `com.google.android.apps.messaging`, `com.samsung.android.messaging`,
   `com.android.mms`, `com.android.messaging`.
3. Title + text + big text are concatenated and lower-cased.
4. Incomplete states (`pending`, `processing`, `failed`, `declined`, `unsuccessful`,
   `initiated`) and OTP-only messages are rejected.
5. The message is classified as income (`credited`, `received`, `refund`, `cashback`) or
   expense (`debited`, `debit`, `paid`, `sent`, `purchase`). Ambiguous messages are ignored.
6. The amount is extracted with `(Rs|INR|₹)\s*([0-9,]+(\.\d{1,2})?)` and converted to paise.
7. The merchant is extracted with several ordered patterns (`paid ... to X`,
   `debited ... at/to X`, `credited ... from X`), falling back to `"Unknown"`.
8. A SHA-256 dedupe key is built from package + notification key + post time + content.
   A unique index on `dedupeKey` makes repeat callbacks a no-op.
9. The row is inserted with `sourcePackage` set to the messaging package (or `"manual"`).
10. For expenses, `BudgetAlerts.check()` is called to post a low-budget notification.

### Categorisation priority

1. **User Smart rules** — matched against merchant + full message text.
2. **Built-in keyword list** in `CategoryRules.java` — matched against the merchant only, so a
   bank name in the message cannot accidentally trigger a rule.
3. **Fallback** — `Online Payment` for SMS-detected items.

Built-in keywords cover common Indian merchants and services: Swiggy, Zomato, BigBasket,
Blinkit, Zepto, DMart, Uber, Ola, Rapido, IRCTC, Amazon, Flipkart, Myntra, Airtel, Jio,
Netflix, Spotify, Apollo, 1mg, Udemy, Coursera, and more.

Manual entries also use your Smart rules to pre-select a category while you type.

---

## Project structure

```text
.
├── android/                          # Capacitor Android project (Java)
│   └── app/src/main/
│       ├── AndroidManifest.xml       # notification listener + file provider
│       └── java/com/autoet/expensetracker/
│           ├── MainActivity.java             # registers plugin, asks for notification permission
│           ├── TransactionPlugin.java        # Capacitor bridge: transactions, KV, export, status
│           ├── ExpenseNotificationListener.java  # SMS notification parsing + filtering
│           ├── CategoryRules.java            # user rules + built-in keyword categorisation
│           ├── BudgetAlerts.java             # native low-budget notifications
│           ├── AutoEtDatabase.java           # Room DB v4 + migrations 1→2→3→4
│           ├── Transaction.java / TransactionDao.java
│           ├── KvEntry.java / KvDao.java     # settings / rules / loans store
│           └── DatabaseKeyManager.java       # Android Keystore AES-GCM passphrase
│
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # shell, bottom tabs, sheets, toast
│   ├── fonts.ts                  # bundled font imports
│   ├── lib/
│   │   ├── types.ts              # Transaction, Category, Rule, Loan, Settings
│   │   ├── defaults.ts           # palette, accents, default categories/settings
│   │   ├── format.ts             # ₹ formatting, date helpers, paise ↔ rupees
│   │   ├── period.ts             # month cycles, ranges, buckets, elapsed days
│   │   ├── analytics.ts          # summaries, grouping, CSV export
│   │   ├── csv.ts                # tolerant CSV parser + column detection
│   │   └── emojis.ts             # emoji catalogue for the picker
│   ├── store/
│   │   └── AppStore.tsx          # React context: data, settings, rules, loans, toasts
│   ├── plugins/
│   │   ├── transactionPlugin.ts      # typed Capacitor plugin interface
│   │   └── transactionPluginWeb.ts   # localStorage fallback with demo data
│   ├── components/
│   │   ├── ui.tsx                # icons, sheet, confirm, segmented, toggle, meter, field
│   │   ├── charts.tsx            # SVG donut + bar charts
│   │   ├── TxnRow.tsx            # transaction row
│   │   ├── TxnSheets.tsx         # add/edit + detail sheets
│   │   ├── RankList.tsx          # ranked bars (categories / merchants)
│   │   ├── CalendarSheet.tsx     # calendar + day stats
│   │   ├── BalanceTableSheet.tsx # month-by-month financial ledger
│   │   ├── CategoryDetailSheet.tsx
│   │   ├── EmojiPicker.tsx
│   │   └── Intro.tsx             # first-run tour
│   ├── screens/
│   │   ├── Home.tsx
│   │   ├── History.tsx
│   │   ├── Stats.tsx
│   │   ├── Budget.tsx
│   │   └── Settings.tsx
│   └── styles/
│       ├── tokens.css            # design tokens, themes, accent/corner/shadow variants
│       ├── base.css
│       ├── components.css
│       ├── screens.css
│       └── intro.css
│
├── public/                       # favicon + icon sprite
├── index.html
├── vite.config.ts
├── capacitor.config.ts
├── package.json
├── tsconfig*.json
├── eslint.config.js
└── emulator-screen.png
```

---

## Getting started

### Prerequisites

- **Node.js 20+** and npm
- For Android builds: **Android Studio** (or the Android SDK + JDK), with an emulator or device
- Android **7.0 (API 24)** or newer

### Run in the browser

```bash
npm install
npm run dev
```

The browser build uses `transactionPluginWeb.ts`, which seeds a realistic set of demo
transactions into `localStorage`. Everything works except native features: SMS
auto-tracking, native budget notifications, and the Android share sheet. CSV export
downloads a file; CSV import reads a local file.

### Run on Android

```bash
npm run build          # tsc -b && vite build
npx cap sync android   # copy dist/ into the Android project + sync plugins
npx cap open android   # open Android Studio, then Run
```

`npx cap sync android` must be re-run after every production build so the WebView receives
the latest `dist/` bundle.

### Enable SMS auto-tracking

1. Open the app.
2. Tap the **gear** on Home (or the banner if it is visible).
3. Under **SMS auto-tracking**, tap **Open notification access**.
4. Enable **Auto Et** in the system list, then return to the app.

The app re-checks the permission when it regains focus and every 15 seconds while visible.
On Android 13+, the app also requests the `POST_NOTIFICATIONS` runtime permission on first
launch so budget alerts can be shown.

---

## How the app works

### Screens

| Screen | What it does |
| --- | --- |
| **Home** | Month-at-a-glance dashboard: balance / left-to-spend, earned vs. spent, top categories, recent activity, calendar, financial ledger. |
| **History** | Searchable, filterable list of all transactions, grouped by day with daily net. |
| **Stats** | Period-based analytics: trends, donut breakdown, top lists, averages and period-over-period change. |
| **Budget** | Monthly limit, per-category limits, savings goal and loans. |
| **Settings** | Profile, appearance, money preferences, auto-tracking status, categories, smart rules, import/export, delete-all, app tour. |

Navigation is a fixed bottom bar for Home / History / Stats / Budget, plus a floating
**+** button available on every tab. Settings opens as a full-page overlay with sub-pages
for Categories and Smart rules.

### Periods, budgets and pay-day cycles

All amounts are stored as **integer paise** (`₹250.50` → `25050`) to avoid floating-point
rounding. Display formatting uses `Intl.NumberFormat('en-IN')`.

`src/lib/period.ts` is the single source of truth for time ranges:

- **Day**: local midnight → next midnight, split into `00-06 / 06-12 / 12-18 / 18-24` buckets.
- **Week**: Monday → Sunday, split into weekday buckets.
- **Month**: a custom cycle starting on `settings.startDay` (clamped to 1–28), split into
  weekly buckets. This lets pay-day cycles (e.g. the 25th) line up with budgets.
- **Year**: January → December, monthly buckets.
- **All time**: last 12 calendar months for the chart; true all-time for totals.

`elapsedDays()` counts only days that have actually happened, so "daily average" and
"safe to spend per day" are meaningful mid-cycle. The native `BudgetAlerts.cycleRange()`
mirrors the same month-cycle logic.

### Data model

```ts
type TxnType = 'EXPENSE' | 'INCOME'

interface Transaction {
  id: number
  amountPaise: number      // integer paise
  currency: string         // "INR"
  merchant: string
  type: TxnType
  transactionTime: number  // epoch ms
  sourcePackage?: string   // messaging package, or "manual"
  category: string         // free text; custom categories allowed
  note?: string
}

interface Category { name: string; emoji: string; color: string; builtin?: boolean }

interface Rule { keyword: string; category: string }

interface Loan {
  id: string
  lender: string
  amountPaise: number   // 0 = amount not recorded
  dueDate?: number      // epoch ms, start of day
  note?: string
  paid: boolean
}

interface Settings {
  name: string
  theme: 'light' | 'dark' | 'auto'
  accent: string
  corners: 'sharp' | 'soft' | 'round'
  shadow: 'flat' | 'bold' | 'heavy'
  hideAmounts: boolean
  startDay: number                 // 1–28
  monthlyBudget: number            // paise, 0 = not set
  categoryBudgets: Record<string, number>
  savingsPct: number
  budgetAlerts: boolean
  categories: Category[]
}
```

The native `transactions` table adds a `dedupeKey` column with a unique index. The
`kv_store` table holds settings, rules, loans, the intro flag, and budget-alert state.

### Storage keys

| Key | Store | Purpose |
| --- | --- | --- |
| `settings` | native `kv_store` | Full settings JSON, including categories |
| `rules` | native `kv_store` | Smart rules, read directly by the SMS listener |
| `loans` | native `kv_store` | Loan list |
| `introDone` | native `kv_store` | Set once the tour is completed |
| `budgetAlertState` | native `kv_store` | `<cycleStart>:<level>` to avoid duplicate alerts |
| `autoet.settings.cache` | localStorage | Fast settings boot on the web layer |
| `autoet.rules.cache` | localStorage | Fast rules boot |
| `autoet.loans.cache` | localStorage | Fast loans boot |
| `autoet.intro.done` | localStorage | Skip the tour on next launch |
| `autoet.web.transactions` | localStorage | Browser demo database (web only) |
| `autoet.web.kv` | localStorage | Browser key/value stand-in (web only) |

If the web cache is cleared but the encrypted database still knows the user, the app
detects the existing `settings`/`introDone` values and skips the tour.

---

## CSV import and export

### Export

**Settings → Your data → Export as CSV** produces a UTF-8 file named
`auto-et-YYYY-MM-DD.csv` with the columns:

```csv
date,type,amount_inr,merchant,category,note,source
2026-11-05T08:20:00.000Z,EXPENSE,349.00,Swiggy,Food & Dining,,sms
```

`date` is an ISO timestamp, `source` is `sms` or `manual`. On Android the file is written
to the app cache and shared via the Android share sheet; in the browser it downloads
directly.

### Import

**Settings → Your data → Import from CSV** accepts comma-, semicolon- or tab-separated
files, with or without a UTF-8 BOM, quoted cells and escaped quotes.

Column names are matched case-insensitively, with flexible aliases:

| Field | Accepted headers |
| --- | --- |
| `date` | date, time, datetime, transaction date, txn date, value date, timestamp, posted |
| `type` | type, transaction type, txn type, dr cr, cr dr |
| `amount` | amount, amount inr, amount rs, value, transaction amount |
| `debit` | debit, withdrawal, withdrawal amt, withdrawals, paid out, dr |
| `credit` | credit, deposit, deposit amt, deposits, paid in, cr |
| `merchant` | merchant, description, payee, narration, particulars, details, name, title, paid to |
| `category` | category |
| `note` | note, notes, memo, remarks, comment |

Supported amounts include `₹1,234.50`, `Rs. 1234`, `-500`, `(500)` and `500 DR`.
Dates support ISO (`2026-11-05T13:20:00`), Indian day-first (`05/11/2026`, `05-11-26`,
`05.11.2026`), and `5 Nov 2026` / `05-Nov-2026` formats. If a type column is absent, a
negative amount means expense; otherwise the sign or debit/credit columns decide.

Import behaviour:

- Rows are deduplicated against existing data on `time | paise | type | merchant`.
- Unknown categories are created automatically with a `🏷️` emoji and a palette colour.
- Unreadable rows are skipped and reported in a summary toast.

---

## Native plugin API

Defined in `src/plugins/transactionPlugin.ts` and implemented by
`android/.../TransactionPlugin.java`; the browser fallback lives in
`src/plugins/transactionPluginWeb.ts`.

| Method | Description |
| --- | --- |
| `getTransactions()` | All transactions, newest first. |
| `addTransaction(input)` | Validates and inserts a manual transaction; returns its id. |
| `updateTransaction(input)` | Updates all editable fields of an existing transaction. |
| `deleteTransaction({ transactionId })` | Deletes one transaction. |
| `updateCategory({ transactionId, category })` | Changes a single transaction's category. |
| `reassignCategory({ from, to })` | Bulk-moves transactions when a category is renamed/deleted. |
| `clearAllTransactions()` | Deletes all transactions (keeps settings/categories). |
| `getValue({ key })` / `setValue({ key, value })` | Encrypted key/value settings storage. |
| `checkBudgetAlert()` | Re-evaluates the low-budget notification after edits. |
| `isNotificationAccessEnabled()` | Reports whether Auto Et has notification-listener access. |
| `openNotificationAccessSettings()` | Opens the Android notification-access screen. |
| `exportCsv({ csv, fileName })` | Writes a CSV and opens the Android share sheet. |

All database work runs on a single-thread executor. Amounts are validated server-side
(`> 0`), type must be `EXPENSE` or `INCOME`, category text is trimmed and limited to 40
characters, and notes to 200 characters.

---

## Privacy and security

- **Encrypted at rest** — the Room database is opened through SQLCipher with a random
  256-bit passphrase. Room is configured with `SupportOpenHelperFactory(passphrase)`.
- **Keystore-backed key** — `DatabaseKeyManager` generates the passphrase, encrypts it with
  an Android Keystore AES-256-GCM key, and stores only the ciphertext + IV in private
  SharedPreferences.
- **No backups** — `android:allowBackup="false"` keeps the encrypted database out of cloud
  backups.
- **No network permission** — the manifest does not request `INTERNET`; the app makes no
  network calls. Fonts are bundled through `@fontsource`.
- **Local-only processing** — SMS content is parsed on the device and never leaves it. The
  `sourcePackage` field records only which messaging app produced the notification.
- **User control** — export to CSV, import from CSV, delete all transactions, or revoke
  notification access at any time.

> **Note:** the `localStorage` fallback used by `npm run dev` is **not encrypted**. It is a
> development convenience only; production data lives in the encrypted Android database.

---

## Design system

The visual language is **neo-brutalist**: thick ink borders, hard offset shadows, flat
saturated colour, chunky display type.

Tokens live in `src/styles/tokens.css` and are driven by data attributes on `<html>`:

| Setting | Attribute / variable | Options |
| --- | --- | --- |
| Theme | `data-theme` | `light`, `dark` (auto follows `prefers-color-scheme`) |
| Accent | `--accent` | Sun, Violet, Coral, Lime, Sky, Pink |
| Corners | `data-corners` → `--r` | `sharp` 4px, `soft` 16px, `round` 28px |
| Shadow | `data-shadow` → `--off` | `flat` 0px, `bold` 5px, `heavy` 9px |

- Display font: **Archivo Black**; body font: **Space Grotesk**.
- Coloured `.tone` cards re-point local tokens to ink so controls keep black borders in
  both themes.
- Icons are a small hand-built SVG set (`PATHS` in `ui.tsx`); charts are pure SVG
  (annular sectors for the donut, capsule tracks for bars).
- Safe-area insets are respected for notches and gesture bars.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (browser mode, localStorage demo data). |
| `npm run build` | Type-check the project (`tsc -b`) and build production assets into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint over the project. |
| `npx cap sync android` | Copy the web build and sync native plugins. |
| `npx cap open android` | Open the Android project in Android Studio. |

There is currently no automated test suite or CI configuration.

---

## Known limitations

- **Android only for auto-tracking.** The browser build is a full UI preview but cannot
  read SMS or post native notifications.
- **SMS formats vary by bank.** Parsing is best-effort and based on common Indian bank /
  UPI phrasing; unusual formats may be ignored or need a merchant correction.
- **Notification access is required** for automatic tracking. Manual entry always works.
- **No sync or cloud backup** — by design. Use CSV export to move data.
- **Deleting a custom category** moves its transactions to `Other` and removes its budget
  and matching rules. Built-in categories cannot be renamed or deleted.
- **Month start day is limited to 1–28** to keep every month valid.
- **Web demo data** is seeded only once per browser; clearing site data resets it.

---

## Contributing

1. Fork the repo and create a feature branch.
2. Keep the existing structure, naming and neo-brutalist styling.
3. Run `npm run lint` and `npm run build` before opening a pull request.
4. For native changes, rebuild with `npm run build && npx cap sync android` and test on a
   device or emulator.

---

## Acknowledgements

- React, Vite, Capacitor, Room and SQLCipher.
- Archivo Black and Space Grotesk via Fontsource.
- Built as a private, offline-first alternative to cloud expense trackers.
