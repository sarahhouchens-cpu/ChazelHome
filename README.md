# Chazel Home

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
