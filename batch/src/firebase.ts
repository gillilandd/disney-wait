import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

export function initFirebase(): void {
  if (admin.apps && admin.apps.length > 0) return;

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const fileEnvPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  const defaultFile = path.resolve(process.cwd(), 'firebase-service-account.json');
  const filePath = fileEnvPath ? path.resolve(fileEnvPath) : defaultFile;

  try {
    // Prefer an explicit service account file if it exists
    if (fs.existsSync(filePath)) {
      const json = fs.readFileSync(filePath, 'utf-8');
      const serviceAccount = JSON.parse(json);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('Firebase initialized from service account file:', filePath);
    } else if (base64) {
      const json = Buffer.from(base64, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(json);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('Firebase initialized from base64 service account');
    } else if (raw) {
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('Firebase initialized from raw service account');
    } else {
      // Fallback to GOOGLE_APPLICATION_CREDENTIALS or environment defaults
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      console.log('Firebase initialized using application default credentials');
    }
    
    admin.firestore().settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    console.error('Failed to initialize Firebase:', err);
    throw err;
  }
}

export async function addDocument(collection: string, doc: any): Promise<string> {
  const db = admin.firestore();
  const ref = await db.collection(collection).add(doc);
  return ref.id;
}

/**
 * Ensure a park document exists at `parks/{parkId}` (merge to avoid overwriting existing data).
 */
export async function upsertPark(parkId: string, data?: { name?: string }): Promise<FirebaseFirestore.DocumentReference> {
  const db = admin.firestore();
  const ref = db.collection('parks').doc(parkId);
  await ref.set({ id: parkId, ...(data ?? {}) }, { merge: true });
  return ref;
}

/**
 * Ensure a ride document exists at `parks/{parkId}/rides/{rideId}` (merge to avoid overwriting existing data).
 */
export async function upsertRide(parkId: string, rideId: string, data?: { name?: string }): Promise<FirebaseFirestore.DocumentReference> {
  const db = admin.firestore();
  const ref = db.collection('parks').doc(parkId).collection('rides').doc(rideId);
  await ref.set({ id: rideId, ...(data ?? {}) }, { merge: true });
  return ref;
}

/**
 * Find a park document by exact name. Returns the doc id or null.
 */
export async function findParkByName(name: string): Promise<string | null> {
  const db = admin.firestore();
  const snapshot = await db.collection('parks').where('name', '==', name).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

/**
 * Basic slug generator to create friendly firebase IDs from names.
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 150);
}

/**
 * Get or create a park id derived from the park name. Attempts an exact name lookup first, otherwise creates a slugified id (appends suffix on collision).
 */
export async function getOrCreateParkIdByName(name: string): Promise<string> {
  if (!name) throw new Error('Park name is required');
  const db = admin.firestore();
  const existing = await findParkByName(name);
  if (existing) return existing;

  const base = slugifyName(name);
  let candidate = base;
  let i = 0;
  while (true) {
    const ref = db.collection('parks').doc(candidate);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({ id: candidate, name }, { merge: true });
      return candidate;
    }
    const data = doc.data();
    if (data && data.name === name) return candidate;
    i += 1;
    candidate = `${base}-${i}`;
  }
}

/**
 * Find a ride document by exact name under a park. Returns the doc id or null.
 */
export async function findRideByName(parkId: string, name: string): Promise<string | null> {
  const db = admin.firestore();
  const snapshot = await db.collection('parks').doc(parkId).collection('rides').where('name', '==', name).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

/**
 * Get or create a ride id under the given park using the ride name.
 */
export async function getOrCreateRideIdByName(parkId: string, name: string): Promise<string> {
  if (!name) throw new Error('Ride name is required');
  const db = admin.firestore();
  const existing = await findRideByName(parkId, name);
  if (existing) return existing;

  const base = slugifyName(name);
  let candidate = base;
  let i = 0;
  while (true) {
    const ref = db.collection('parks').doc(parkId).collection('rides').doc(candidate);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({ id: candidate, name }, { merge: true });
      return candidate;
    }
    const data = doc.data();
    if (data && data.name === name) return candidate;
    i += 1;
    candidate = `${base}-${i}`;
  }
}

export interface WaitTimeEntry {
  wait_minutes: number | null;
  timestamp: string; // ISO
  status?: string | null;
  source?: string | null;
  [k: string]: any;
}

/**
 * Add a wait time entry into `parks/{parkId}/rides/{rideId}/wait_times/`
 */
export async function addWaitTime(
  parkId: string,
  rideId: string,
  wait_minutes: number | null,
  status?: string | null,
  timestamp?: string | Date,
  extra?: Record<string, any>
): Promise<string> {
  const db = admin.firestore();
  const ts = timestamp ?? new Date();
  const tsIso = ts instanceof Date ? ts.toISOString() : String(ts);

  // Ensure parent documents exist (id + optional name)
  await upsertPark(parkId);
  await upsertRide(parkId, rideId);

  const entry: WaitTimeEntry = {
    wait_minutes,
    status: status ?? null,
    timestamp: tsIso,
    ...(extra ?? {}),
  };

  const ref = await db
    .collection('parks')
    .doc(parkId)
    .collection('rides')
    .doc(rideId)
    .collection('wait_times')
    .add(entry);

  return ref.id;
}

/**
 * Helper to extract a numeric wait from the API's queue object when possible.
 */
export function extractWaitMinutes(queue: any): number | null {
  if (queue == null) return null;
  if (typeof queue === 'number') return queue;
  if (queue.STANDBY && typeof queue.STANDBY.waitTime === 'number') return queue.STANDBY.waitTime;
  if (queue.PAID_STANDBY && typeof queue.PAID_STANDBY.waitTime === 'number') return queue.PAID_STANDBY.waitTime;
  // Some responses use a single waitTime property
  if (typeof queue.waitTime === 'number') return queue.waitTime;
  return null;
}

/**
 * Save an array of attractions for a park into the nested wait_times subcollection.
 * Each attraction should contain { id, name?, status?, queue? }.
 */
export async function saveParkAttractionsWaits(
  parkId: string,
  attractions: Array<{ id: string; name?: string; status?: string; queue?: any }>,
  source?: string
): Promise<void> {
  for (const a of attractions) {
    // Upsert ride doc with name when available
    if (a.name) await upsertRide(parkId, a.id, { name: a.name });

    const wait = extractWaitMinutes(a.queue);
    await addWaitTime(parkId, a.id, wait, a.status ?? null, new Date(), { source });
  }
}

