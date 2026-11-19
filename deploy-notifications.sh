#!/usr/bin/env bash
# Sets up HomeIQ's notification jobs in Firebase. Run it in Google Cloud Shell:
#   git clone https://github.com/sarahhouchens-cpu/ChazelHome && bash ChazelHome/deploy-notifications.sh
# Safe to run again; it updates what's there.
set -euo pipefail
PROJECT="homeiq-61b06"
cd "$(dirname "$0")"
git pull --quiet || true

echo "→ Using Firebase project $PROJECT"
gcloud config set project "$PROJECT" --quiet >/dev/null

# Run the jobs in the same place as the database (required for database triggers).
LOCATION=$(gcloud firestore databases describe --database='(default)' --format='value(locationId)')
case "$LOCATION" in
  nam5) REGION=us-central1 ;;
  eur3) REGION=europe-west1 ;;
  *)    REGION="$LOCATION" ;;
esac
echo "→ Database is in $LOCATION; notification jobs will run in $REGION"
printf 'FUNCTION_REGION=%s\n' "$REGION" > functions/.env

echo "→ Installing (about a minute)"
(cd functions && npm ci --silent --no-audit --no-fund)

echo "→ Deploying security rules, database index and notification jobs (3–5 minutes)"
if ! npx --yes firebase-tools@15.36.0 deploy --only functions,firestore --project "$PROJECT" --force --non-interactive; then
  echo
  echo "Deploy didn't finish. If the error mentions Eventarc or a service agent permission,"
  echo "Google is still setting up the project: wait 5 minutes and run the same command again."
  echo "If it says you're not logged in, run:  npx firebase-tools@15.36.0 login --no-localhost"
  echo "follow the link it prints, then run the same command again."
  exit 1
fi
echo
echo "✓ Done. Notifications are set up."
