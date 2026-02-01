export const API_URL = process.env.API_URL ?? 'https://api.themeparks.wiki/v1';
export const API_KEY = process.env.API_KEY;
export const POLL_MINUTES = Number(process.env.POLL_INTERVAL_MINUTES ?? 10);
export const COLLECTION = process.env.FIRESTORE_COLLECTION ?? 'fetchedData';
export const HEALTH_PORT = Number(process.env.HEALTH_PORT ?? 3000);
