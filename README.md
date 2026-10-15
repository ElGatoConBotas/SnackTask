# SnackTask

An office game for daily goals. Everyone plans today's tasks with a time estimate and a stake. Tasks go on a shared live board, a timer measures the work, and a leaderboard keeps score. Missed tasks land on the snack ledger 🍩.

The app has two parts:

- **The website** (the screens people see) is hosted for free on **GitHub Pages**.
- **The database** (shared board, logins, scores) runs on a free **Supabase** project.

Setup takes about 30-45 minutes and needs no programming. Follow the steps in order.

---

## Step 1: Create the database (Supabase)

1. Go to **supabase.com** and sign up (signing in with GitHub is easiest).
2. Click **New project**:
   - Name: `snacktask`
   - Database password: click *Generate* and save it somewhere safe (you will rarely need it)
   - Region: **Central EU (Frankfurt)**
   - Click **Create new project** and wait about 2 minutes.
3. In the left menu open **SQL Editor** and click **New query**.
4. Open the file `supabase/schema.sql` from this folder in Notepad, select all, copy, and paste it into the editor.
5. **Important:** scroll to the very last lines and replace `your.email@company.si` with **your own email**. This makes you the admin.
6. Click **Run**. You should see "Success. No rows returned".

### Login emails

People sign in with a code sent to their email, so there are no passwords.

7. Open **Authentication → Emails → Templates**.
8. In **both** the *Confirm signup* and the *Magic Link* template, add this line to the message body and click **Save**:
   ```
   <p>Tvoja koda / Your code: <strong>{{ .Token }}</strong></p>
   ```
   People can then type the code in the app. That's handy when the email is opened on a phone and the app runs on a computer.

> **Email limit:** Supabase's built-in email sender only sends a few emails per hour. That is enough for testing, but for inviting all 21 colleagues on the same day, connect a free email service: **Authentication → Emails → SMTP Settings**. For example, Brevo and Resend both have free plans with step-by-step guides for Supabase. Once everyone is logged in, logins last for weeks, so few emails are needed afterwards.

### Copy two values for later

9. Open **Project Settings → API** (on newer dashboards: **Project Settings → API Keys** and **Data API**) and copy:
   - **Project URL**, like `https://abcdefgh.supabase.co`
   - **anon / public key** (or **publishable key**), a long text
   These two are safe to put in a website. **Never** use the `service_role` / secret key anywhere.

---

## Step 2: Put the website on GitHub Pages

1. Go to **github.com**, sign in, and click **New repository** (the **+** at top right).
   - Name: `snacktask`
   - Visibility: **Public** (GitHub Pages is free for public repositories; your data stays private in Supabase)
   - Click **Create repository**.
2. On the new empty repository page click **uploading an existing file**.
3. Drag **everything inside this `snacktask` folder** into the browser window: the folders `public`, `src`, `supabase` and all the files. Then click **Commit changes**.
4. Add the file that builds the site: on the repository page click **Add file → Create new file**. As the name, type exactly `.github/workflows/deploy.yml` (the slashes create the folders). Open `deploy-workflow.yml` from this folder in Notepad, copy everything, paste it in, and click **Commit changes**.
   You can then delete the extra `deploy-workflow.yml` from the repository, but leaving it there does no harm.
5. Open **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable** and add two:
   - `VITE_SUPABASE_URL` = the Project URL from Supabase
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key from Supabase
6. Open **Settings → Pages**. Under *Build and deployment → Source* choose **GitHub Actions**.
7. Open the **Actions** tab, click **Deploy to GitHub Pages** on the left, then **Run workflow**. After 1-2 minutes it turns green ✅.
8. Your app is now live at **`https://YOUR-GITHUB-NAME.github.io/snacktask/`**

> If you skip step 5, the site still works, but in **demo mode** with made-up colleagues. That's a nice way to show the idea to the office before launching.

---

## Step 3: Connect the login links to your site

Back in Supabase, open **Authentication → URL Configuration**:

- **Site URL:** `https://YOUR-GITHUB-NAME.github.io/snacktask/`
- **Redirect URLs:** add the same address

---

## Step 4: First login and inviting colleagues

1. Open your app address, type your email, then type the code from the email (or click the link).
2. You are the admin, so you see an **Admin** tab. Under **Invite list**, paste your colleagues' emails. You can paste several at once, separated by commas or new lines.
3. Send colleagues the app address. They sign in the same way.
4. On a phone: open the address and choose *Add to Home Screen* so it opens like an app.

### TV mode
On the office screen, sign in with any account and open
`https://YOUR-GITHUB-NAME.github.io/snacktask/#/tv`
Press **F11** for full screen. It updates by itself and scrolls slowly if not everyone fits.

---

## How the game works (short version)

| When | What happens |
| --- | --- |
| Before **10:00** | Add up to 5 tasks (at least 15 min each), choose a stake, and optionally make a task private. Not in today? Tap *I am away today*. |
| **10:00** | Plans are locked: no adding, editing or deleting. |
| During the day | Start / Pause / Finish the timer. Only one timer runs at a time. |
| **17:00** | Unfinished tasks become *missed*. Each one goes on the snack ledger with its stake. |
| Monday | The weekly leaderboard starts fresh, and last week's winner goes into the hall of fame. |

**Points:** done = +5, done within the estimate (timer used) = +5 bonus, missed = −5.
All of these numbers and times can be changed on the **Admin** page. Weekends and Slovenian public holidays for 2026-2027 are already skipped, and you can add office closures on the Admin page.

---

## Changing things later

- **Rules, points, times, stake presets, prize of the week, holidays:** Admin page in the app, no code needed.
- **Any text in the app (Slovenian and English):** the file `src/i18n.ts` on GitHub. Click the file, then the ✏️ pencil, edit the words, and click **Commit changes**. The site updates itself in about 2 minutes.
- **Colors:** the top of `src/styles.css`.

## Trying it on your own computer (optional)

Install Node.js (LTS) from nodejs.org, open a terminal in this folder and run:
```
npm install
npm run dev
```
Then open the address it shows. Without a `.env` file it runs in demo mode. To connect it to Supabase, copy `.env.example` to `.env` and fill in the two values.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Your email is not on the invite list" | The admin adds the email on the Admin page, then the person clicks *Try again*. |
| No email arrives | Check spam. If many people log in at once, Supabase's email limit is reached, so set up SMTP (see Step 1). |
| The link in the email opens an error page | Check Step 3 (Site URL and Redirect URLs). Typing the code always works. |
| The site shows demo mode | The two GitHub variables (Step 2.5) are missing or misspelled. Fix them and run the workflow again. |
| Actions build fails | Open the failed run and read the red step. Most often a variable name has a typo. |
| Supabase *Advisors* warns about "security definer views" | Expected. Those views deliberately hide private task titles, and they check membership themselves. |
| Supabase project "paused" | Free projects pause after about a week without any use. Click *Restore* in Supabase. Daily use prevents this. |

## What's inside

```
supabase/schema.sql      database: tables, rules, scoring (run once)
src/                     the app (React + TypeScript)
  i18n.ts                all texts, Slovenian + English
  styles.css             look and colors
  pages/                 Today, Board, Leaderboard, Stats, Ledger, Profile, Admin, TV
  api/                   talks to Supabase (or the built-in demo)
.github/workflows/       builds and publishes the site on GitHub Pages
```

The game rules are checked in the database itself (task limit, 10:00 lock, one timer at a time, 17:00 close, private titles, admin rights), so nobody can cheat by tinkering with the website.
