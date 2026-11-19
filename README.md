# HomeIQ

A shared household website: calendar, Groceries / Household / Fun lists, recipes and a weekly menu that fills the grocery list, and to-dos you can assign and repeat. Each person signs in with their own account and everyone in the home sees changes live.

**Website:** https://sarahhouchens-cpu.github.io/ChazelHome/ (live once the steps below are done)

## One-time setup (about 15 minutes, no coding)

### 1. Turn on the website (GitHub Pages)
1. In this repo on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick the branch **claude/admiring-keller-5l0to4** and the folder **/docs**, then **Save**.
4. After a minute or two the page shows your site's address.

### 2. Create the Firebase project (logins and shared data, free)
1. Go to <https://console.firebase.google.com>, sign in with a Google account, and click **Create a project**. Name it `homeiq`. You can turn Google Analytics off.
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
3. Still in Authentication, open **Settings → Authorized domains → Add domain** and add `sarahhouchens-cpu.github.io`.
4. **Build → Firestore Database → Create database.** Choose a location near you and **Start in production mode**.
5. In Firestore, open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules) from this repo, and click **Publish**.
6. Click the gear icon → **Project settings**. Under **Your apps**, click the **</>** (Web) icon, name it `HomeIQ`, and click **Register app** (skip Firebase Hosting).
7. Copy the `firebaseConfig` block it shows (apiKey, authDomain, projectId, …).

### 3. Connect the two
Paste that `firebaseConfig` into [`docs/config.js`](docs/config.js) (on GitHub: open the file, click the pencil icon, paste the values, **Commit changes**). Or send it to Claude and it will do this for you. These values identify your project; they are meant to be public, and the security rules decide who can see your data.

### 4. Start using it
1. Open the website, **Create an account**, then **Create home**.
2. On the **Household** page, tap **Send invite** (or copy the 6-character code) and send it to your partner.
3. They open the website, create their own account, choose **Join an existing home** and enter the code.
4. On iPhone: open the site in Safari → Share → **Add to Home Screen** for an app icon.

## Notifications
Phones get a notification for reminders of events you are going to, when someone else adds an event, when someone assigns you a to-do, and when someone asks you to pick something up. Setup, once:
1. **Firebase billing:** Firebase console → upgrade to the **Blaze (pay as you go)** plan and set a budget alert (e.g. $1). A household's usage stays in the free allowance.
2. **Web push key:** Project settings → **Cloud Messaging** → **Web Push certificates** → **Generate key pair**. Put the key in `vapidKey` in `docs/config.js` and `webapp/public/config.js` (or send it to Claude).
3. **Background jobs:** open <https://console.cloud.google.com>, click the **Activate Cloud Shell** button (`>_`, top right), and paste:
   ```
   git clone https://github.com/sarahhouchens-cpu/ChazelHome && bash ChazelHome/deploy-notifications.sh
   ```
   To update later: `bash ChazelHome/deploy-notifications.sh`.
4. **Each phone:** on iPhone (iOS 16.4 or later), add HomeIQ to the Home Screen from Safari, open it from that icon, then **Household → Turn on notifications**. On Android or a computer, just tap the button.

## For developers
- Website source: `webapp/` (React + Firebase, built with Vite). `cd webapp && npm install && npm run build` writes the site into `docs/` (keep `webapp/public/config.js` matching `docs/config.js`, or a rebuild will blank the settings). `npm test` runs the logic tests.
- `firestore.rules`: who can read and write what. Tested in `rules-tests/` with the Firestore emulator.
- `web/homeiq.html`: the earlier claude.ai version (https://claude.ai/artifact/18huTwwcpmg1pfu2E6jucg).
- `functions/`: notification jobs (Firebase Cloud Functions), deployed by `deploy-notifications.sh`.
- `src/`, `app.json`: the earlier iPhone app (Expo + Firebase), kept for reference. Its setup notes follow.

---

# Earlier iPhone version (Expo)
# HomeIQ

**The web version lives at `web/homeiq.html`** and is published as a claude.ai page: https://claude.ai/artifact/18huTwwcpmg1pfu2E6jucg. It needs no setup; sign-in and shared data are handled by claude.ai. Everything below describes the earlier iPhone (Expo + Firebase) version, kept for reference.

A shared household app for two (or more): one calendar, one set of shopping lists, one menu, one to-do list. Each person has their own login; everyone in the same "home" sees and edits the same data in real time.

Built with **Expo (React Native)** for iPhone/iPad, with **Firebase** for accounts, data sync and push notifications.

## Features

| Area | What it does |
| --- | --- |
| **Accounts** | Each person signs up with email and password. Password reset by email. |
| **Homes** | Create a home, then share its 6-character invite code (Settings → Send invite). Your partner creates their own account and joins with the code. |
| **Calendar** | Month view with dots on busy days, day agenda, all-day and multi-day events, color-coded by who added them. |
| **Notifications** | Each event can have a reminder (at time of event, 10 min … 2 days before). Every phone in the home schedules it. With the Cloud Function deployed, housemates also get a push notification when someone adds an event or assigns them a to-do. Tapping a notification opens the event or to-do. |
| **Shopping lists** | Three lists: **Groceries**, **Household**, **Fun**. Quick add with quantity, check off, move between lists, clear checked items. |
| **Recipes** | Save recipes with ingredients (or paste an ingredient list and it's split into quantity + name), instructions, servings, and a link. |
| **Menu** | Weekly breakfast/lunch/dinner plan. Adding a recipe to the menu puts its ingredients on the Groceries list automatically, combining duplicates (e.g. `1 onion + 2 onions`). One tap adds the whole week's ingredients. |
| **To-dos** | Assign to a person or "Anyone", optional due date, and repeat Daily / Weekly / Every 2 weeks / Monthly. Checking off a repeating task rolls it forward to its next due date. Filter by person; overdue / today / upcoming / anytime sections. |
| **Home screen** | Today's events, today's meals, your to-dos due, and how many items are on the lists. |

## Project layout

```
src/app/            Screens (Expo Router: every file is a route)
  (auth)/           Sign in, sign up
  (tabs)/           Home, Calendar, Lists, Menu, To-Do
  event/[id].tsx    Event editor
  todo/[id].tsx     To-do editor
  recipe/           Recipe view + editor
  menu-add.tsx      Add a meal to the menu
  settings.tsx      Invite code, members, profile, sign out
  onboarding.tsx    Create or join a home
src/lib/            Firebase, session/auth, data access, notifications, date logic
src/components/     Shared UI
functions/          Firebase Cloud Functions (housemate push notifications)
firestore.rules     Security rules: only members of a home can see its data
tests/              Unit tests for recurrence and ingredient parsing
```

## Setup

You need: an Apple Developer account ($99/yr) to install on your phones, a free Firebase project, and Node 22. A Mac is not required: EAS builds the iOS app in the cloud.

### 1. Firebase

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication** → Sign-in method → enable **Email/Password**.
3. **Firestore Database** → Create database (production mode).
4. Project settings → **Your apps** → add a **Web** app. Copy its config.
5. `cp .env.example .env.local` and paste the values in.
6. Deploy rules and indexes:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add          # pick your project
   firebase deploy --only firestore
   ```

### 2. Run it

```bash
npm install
npx expo start
```

Expo Go can run most of the app, but push notifications need a development build:

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # adds your EAS projectId to app.json
npx eas-cli@latest build --profile development --platform ios
```

Install the build on your iPhone from the link EAS gives you, then `npx expo start` and open it.

### 3. Housemate push notifications (optional)

Calendar reminders work without this. To also notify each other when events are added or to-dos assigned:

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

This requires the Firebase **Blaze** (pay-as-you-go) plan; usage for a household is well within the free tier. Set `HOME_TIMEZONE` (e.g. `America/Chicago`) in `functions/.env` so times in notifications show in your zone. iOS push also needs APNs credentials, which `eas build` sets up for you.

### 4. Put it on both phones

```bash
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios      # uploads to TestFlight
```

Add your partner as a TestFlight tester in App Store Connect. You don't need to publish publicly.

## Development

```bash
npm run typecheck   # TypeScript
npm test            # unit tests
cd rules-tests && npm install && npm test   # security rules, in the Firestore emulator (needs Java)
```

The app bundle identifier is `com.chazel.home` (in `app.json`); change it if that ID is taken in App Store Connect.
