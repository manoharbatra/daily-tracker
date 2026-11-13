# Deployment: Google Sheets + Apps Script backend

Daily Tracker (the to-do diary) works out of the box with data saved in your browser's localStorage. This guide moves the data into a Google Sheet, with a Google Apps Script web app as the API, so the same data is available on every device.

```
React app (browser) ──POST JSON──▶ Apps Script web app ──▶ Google Sheet ("Todos" and "Goals" tabs)
                    ◀──JSON──────                      ◀──
```

The switch is automatic: when `VITE_API_URL` is set, the app uses Google Sheets; when it isn't, it uses localStorage.

**Time needed:** about 20 minutes. **Cost:** free with a normal Google account.

> Use a **new** spreadsheet and script for Daily Tracker.
>
> If you already set up a sheet for the earlier expense version of Daily Tracker, either create a new spreadsheet, or replace `Code.gs` with the code below, run `setup()` again, and publish a new version (step 9). The old `Entries` tab is no longer used. Running `setup()` again is also how an existing sheet gets newer columns (`minutes`, `goalId`) and the `Goals` tab.
> Don't reuse the Payment Reminder one; the two apps have different data and actions.

---

## 0. Back up your current data

If you've already written tasks in the localStorage version:

1. Run the app (`npm run dev`) without a `.env.local` file.
2. Click **Export**. Keep the downloaded `daily-tracker-backup-YYYY-MM-DD.json`; you'll import it in [step 7](#7-import-your-backed-up-data).

---

## 1. Create the Google Sheet

1. Go to <https://sheets.google.com> and create a **blank spreadsheet**.
2. Name it, for example **Daily Tracker DB**.

The `setup()` function in step 3 creates two tabs with these columns:

| Tab     | Columns                                                 |
| ------- | ------------------------------------------------------- |
| `Todos` | id, date, time, title, done, createdAt, minutes, goalId |
| `Goals` | id, title, targetMinutes, period, slot, createdAt       |

Keep dates as `YYYY-MM-DD` and times as `HH:mm` (24-hour) text, `done` as `true`/`false`, and don't rename or reorder the header row. `date` is empty for tasks in the **Tasks** list (not planned for a day yet); `time` is empty for tasks without a time; `minutes` is the time logged when the task was marked done (empty while it's not done); `goalId` is the goal a task is linked to (empty for none). In `Goals`, `period` is `weekly` or `monthly`, `targetMinutes` is optional, and `slot` (1–8) fixes the goal's chart color.

---

## 2. Add the Apps Script code

1. In the spreadsheet, open **Extensions → Apps Script**.
2. Rename the project to **Daily Tracker API**.
3. **Project Settings** (gear icon): set **Time zone** to yours, e.g. `(GMT+05:30) India Standard Time`. Leave the V8 runtime enabled.
4. Back in **Editor**, replace everything in `Code.gs` with the code below and **Save** (`Ctrl+S`).

```javascript
/**
 * Daily Tracker API: Google Apps Script backend.
 * Every request is a POST with a text/plain JSON body:
 *   { "action": "...", "token": "...", "data": { ... } }
 * Every response is JSON: { "ok": true, "data": ... } or { "ok": false, "error": "..." }
 */

const SHEETS = {
    Todos: [
        "id",
        "date",
        "time",
        "title",
        "done",
        "createdAt",
        "minutes",
        "goalId",
    ],
    Goals: ["id", "title", "targetMinutes", "period", "slot", "createdAt"],
}
const BOOLEAN_FIELDS = ["done"]
const NUMBER_FIELDS = ["minutes", "targetMinutes", "slot"]

/** Run once from the editor (and again after updating this code): creates tabs, headers and the API token. */
function setup() {
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    Object.keys(SHEETS).forEach((name) => {
        const headers = SHEETS[name]
        const sh = ss.getSheetByName(name) || ss.insertSheet(name)
        sh.getRange(1, 1, 1, headers.length)
            .setValues([headers])
            .setFontWeight("bold")
        sh.setFrozenRows(1)
        // Plain text, so Sheets doesn't turn "2026-11-09" or "09:30" into dates.
        sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat("@")
    })
    const blank = ss.getSheetByName("Sheet1")
    if (blank && blank.getLastRow() === 0) ss.deleteSheet(blank)

    const props = PropertiesService.getScriptProperties()
    if (!props.getProperty("API_TOKEN"))
        props.setProperty("API_TOKEN", Utilities.getUuid())
    Logger.log("API_TOKEN = " + props.getProperty("API_TOKEN"))
}

/** Health check: open the web app URL in a browser to see this. */
function doGet() {
    return json_({ ok: true, data: "Daily Tracker API is running" })
}

function doPost(e) {
    try {
        const body = JSON.parse(e.postData.contents)
        const token =
            PropertiesService.getScriptProperties().getProperty("API_TOKEN")
        if (!token || body.token !== token) throw new Error("Invalid token")

        if (body.action === "getAll") {
            return json_({
                ok: true,
                data: { todos: readAll_("Todos"), goals: readAll_("Goals") },
            })
        }

        // Writes take a lock so two requests can't edit the sheet at the same time.
        const lock = LockService.getScriptLock()
        lock.waitLock(10000)
        try {
            const data = body.data || {}
            switch (body.action) {
                case "upsertTodo":
                    upsert_("Todos", data)
                    break
                case "deleteTodo":
                    remove_("Todos", data.id)
                    break
                case "upsertGoal":
                    upsert_("Goals", data)
                    break
                case "deleteGoal":
                    remove_("Goals", data.id)
                    break
                case "importAll":
                    replaceAll_("Todos", data.todos || [])
                    replaceAll_("Goals", data.goals || [])
                    break
                default:
                    throw new Error("Unknown action: " + body.action)
            }
        } finally {
            lock.releaseLock()
        }
        return json_({ ok: true, data: null })
    } catch (err) {
        return json_({ ok: false, error: String((err && err.message) || err) })
    }
}

/* ---------- helpers ---------- */

function sheet_(name) {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
    if (!sh) throw new Error('Missing tab "' + name + '". Run setup() first.')
    return sh
}

function readAll_(name) {
    const sh = sheet_(name)
    const headers = SHEETS[name]
    const last = sh.getLastRow()
    if (last < 2) return []
    return sh
        .getRange(2, 1, last - 1, headers.length)
        .getValues()
        .filter((row) => row[0] !== "")
        .map((row) => toObject_(headers, row))
}

function toObject_(headers, row) {
    const obj = {}
    headers.forEach((h, i) => {
        let v = row[i]
        // Safety net in case a date or time was typed by hand and Sheets converted it.
        if (v instanceof Date) {
            v = Utilities.formatDate(
                v,
                Session.getScriptTimeZone(),
                h === "time" ? "HH:mm" : "yyyy-MM-dd",
            )
        }
        if (BOOLEAN_FIELDS.indexOf(h) >= 0)
            v = v === true || String(v).toLowerCase() === "true"
        else if (v === "") v = null
        else if (NUMBER_FIELDS.indexOf(h) >= 0) v = Number(v)
        else v = String(v)
        obj[h] = v
    })
    return obj
}

function toRow_(headers, obj) {
    return headers.map((h) => (obj[h] == null ? "" : String(obj[h])))
}

function ensureRows_(sh, lastRowNeeded) {
    const max = sh.getMaxRows()
    if (lastRowNeeded > max) sh.insertRowsAfter(max, lastRowNeeded - max)
}

function rowIndex_(sh, id) {
    const last = sh.getLastRow()
    if (last < 2) return -1
    const ids = sh
        .getRange(2, 1, last - 1, 1)
        .getValues()
        .map((r) => String(r[0]))
    const i = ids.indexOf(String(id))
    return i < 0 ? -1 : i + 2
}

function upsert_(name, obj) {
    if (!obj || !obj.id) throw new Error("Missing id")
    const sh = sheet_(name)
    const headers = SHEETS[name]
    let row = rowIndex_(sh, obj.id)
    if (row < 0) {
        row = sh.getLastRow() + 1
        ensureRows_(sh, row)
    }
    sh.getRange(row, 1, 1, headers.length)
        .setNumberFormat("@")
        .setValues([toRow_(headers, obj)])
}

function remove_(name, id) {
    const sh = sheet_(name)
    const row = rowIndex_(sh, id)
    if (row > 0) sh.deleteRow(row)
}

function replaceAll_(name, list) {
    const sh = sheet_(name)
    const headers = SHEETS[name]
    const last = sh.getLastRow()
    if (last >= 2) sh.getRange(2, 1, last - 1, headers.length).clearContent()
    if (!list.length) return
    ensureRows_(sh, list.length + 1)
    sh.getRange(2, 1, list.length, headers.length)
        .setNumberFormat("@")
        .setValues(list.map((o) => toRow_(headers, o)))
}

function json_(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
        ContentService.MimeType.JSON,
    )
}
```

### The API at a glance

| `action`     | `data`             | What it does                                                                                  |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------- |
| `getAll`     | —                  | Returns `{ todos: [...], goals: [...] }`                                                      |
| `upsertTodo` | a todo object      | Adds the task, or updates the row with the same `id` (edit, tick/untick, move to another day) |
| `deleteTodo` | `{ id }`           | Deletes that row                                                                              |
| `upsertGoal` | a goal object      | Adds the goal, or updates the row with the same `id`                                          |
| `deleteGoal` | `{ id }`           | Deletes that goal (linked tasks are kept)                                                     |
| `importAll`  | `{ todos, goals }` | Replaces all rows in both tabs                                                                |

---

## 3. Run setup and get your API token

1. In the editor, choose **`setup`** in the function dropdown and click **Run**.
2. Authorize the first time: **Review permissions** → your account → **Advanced → Go to Daily Tracker API (unsafe)** → **Allow**. The "unverified app" warning is normal for your own scripts.
3. In the **Execution log**, copy the line `API_TOKEN = …`.
4. The spreadsheet now has `Todos` and `Goals` tabs with bold header rows.

You can find the token again under **Project Settings → Script Properties → `API_TOKEN`**.

---

## 4. Deploy as a web app

1. **Deploy → New deployment** → gear icon → **Web app**.
2. **Description:** `v1`. **Execute as:** **Me**. **Who has access:** **Anyone**.
3. Click **Deploy** and copy the **Web app URL** ending in **`/exec`**.

> Copy the URL exactly. A common mistake is leaving a character from the placeholder in front of the deployment ID (e.g. `/s/YAKfycb…` instead of `/s/AKfycb…`), which gives a 404 and a "Failed to fetch" error in the app.

---

## 5. Test the API

Open the `/exec` URL in a browser. You should see `{"ok":true,"data":"Daily Tracker API is running"}`.

Then, in Git Bash:

```bash
curl -L \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"getAll","token":"YOUR_API_TOKEN"}' \
  "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
```

Expected: `{"ok":true,"data":{"todos":[],"goals":[]}}`. `-L` is required because Apps Script answers with a redirect.

---

## 6. Connect the React app

1. Copy `.env.example` to **`.env.local`** in the project root and fill in both values:
    ```bash
    VITE_API_URL=https://script.google.com/macros/s/AKfycb.../exec
    VITE_API_TOKEN=your-token-from-step-3
    ```
    `.env.local` is already in `.gitignore`.
2. **Restart** `npm run dev`. Vite only reads `.env.local` at startup.
3. The app now says "Loading from Google Sheets…" while it loads. Write a task and check that a row appears in the `Todos` tab.

No code changes are needed; [src/api.js](src/api.js) switches to Google Sheets when `VITE_API_URL` is set.

---

## 7. Import your backed-up data

Click **Import** and choose the JSON file from [step 0](#0-back-up-your-current-data). `importAll` **replaces** everything in the sheet, so use it only to restore a full backup.

---

## 8. Host the React app

`npm run build` outputs a static site in `dist/`. On any host, set `VITE_API_URL` and `VITE_API_TOKEN` as environment variables **before the build**, because Vite bakes them into the JavaScript.

- **Netlify:** import the GitHub repo, build command `npm run build`, publish directory `dist`, add the two variables under **Site configuration → Environment variables**, then trigger a deploy.
- **Vercel:** **Add New → Project**, import the repo (Vite is detected), add the two variables, click **Deploy**.
- **GitHub Pages:** set `base: '/your-repo-name/'` in `vite.config.js`, add the two values as repository **Actions secrets**, set **Pages → Source: GitHub Actions**, and use the same workflow file as in the Payment Reminder `deployment.md` (step 8, option C).

---

## 9. Updating the Apps Script later

Saving `Code.gs` does not update the live URL. Use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. Don't use **New deployment** for updates: it creates a different URL.

---

## 10. Security notes

- `VITE_API_TOKEN` ends up in the site's JavaScript, so anyone who opens the site can find it. It keeps out people who only know the `/exec` URL, but it isn't a password. Keep the site URL private, or put it behind a login, if your data is sensitive.
- If the token leaks, change `API_TOKEN` in **Script Properties**, update the env var, and rebuild.
- Don't commit `.env.local`.
- **File → Version history** in Google Sheets lets you restore the sheet after a mistake.

---

## 11. Troubleshooting

| Symptom                                                   | Cause and fix                                                                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| "Failed to fetch" / CORS error, Network tab shows **404** | Wrong `/exec` URL. Copy it again from **Manage deployments**.                                                                       |
| CORS error with a **preflight (OPTIONS)** request         | The request was sent as `application/json`. Keep `text/plain;charset=utf-8` as in `src/api.js`.                                     |
| `Invalid token`                                           | `.env.local` token doesn't match **Script Properties → API_TOKEN**. Fix it and restart `npm run dev`.                               |
| `Missing tab "Todos"` or `"Goals"`                        | Run `setup()` (step 3), and don't rename the tabs. After updating `Code.gs`, run `setup()` again so new tabs and columns are added. |
| Response is an HTML page                                  | Wrong URL (use `/exec`) or **Who has access** isn't **Anyone**.                                                                     |
| Code changes don't show up                                | Publish a new version ([step 9](#9-updating-the-apps-script-later)).                                                                |
| App still shows "Loading from this browser"               | `VITE_API_URL` isn't set, or the dev server wasn't restarted.                                                                       |
