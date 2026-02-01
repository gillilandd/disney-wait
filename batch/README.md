# disney-crowd-batch 🔧

Simple Bun + TypeScript batch worker that polls an API and stores results in Firestore every 10 minutes.

## Setup ✅

1. Install dependencies:

   bun install

2. Copy `.env.example` to `.env` and fill values (API_URL, API_KEY, and Firebase credentials).

   - You can set `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` to the base64-encoded service account JSON (recommended)
   - Or set `GOOGLE_APPLICATION_CREDENTIALS` to point to a local JSON file

3. Run the app:

   bun run start

## Notes 💡

- Poll interval controlled by `POLL_INTERVAL_MINUTES` (default 10)
- Firestore collection configurable via `FIRESTORE_COLLECTION`
- Logs are printed to stdout

## Docker & Docker Compose 🐳

A `Dockerfile` and `docker-compose.yml` are included for containerized deployment. The app exposes a small health endpoint on `/health` (default port `3000`). The image includes a `HEALTHCHECK` which polls this endpoint.

Quick compose commands:

- Build and start: `docker-compose up --build -d`
- View logs: `docker-compose logs -f`
- Stop: `docker-compose down`

Mount your `serviceAccountKey.json` or set `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` in your `.env` when using `docker-compose`.

---

## ThemeParks API Client 🔗

A small typed client for the ThemeParks.Wiki API is included at `src/themeparks.ts`.

Example usage:

```ts
import ThemeParksClient from './src/themeparks';

const client = new ThemeParksClient();

async function demo() {
  const destinations = await client.getDestinations();
  console.log('Destinations:', destinations.destinations?.length);

  const first = destinations.destinations?.[0];
  if (first) {
    const parks = first.parks;
    console.log('Parks in first destination:', parks?.length);

    // example: fetch a park/attraction by slug or id
    // const entity = await client.getEntity('someslug-or-id');
    // console.log(entity.name, entity.entityType);
  }
}

demo().catch(console.error);
```

