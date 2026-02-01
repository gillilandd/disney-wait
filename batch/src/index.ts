import 'dotenv/config';
import { initFirebase, addDocument, getOrCreateParkIdByName, getOrCreateRideIdByName, saveParkAttractionsWaits } from './firebase';
import { fetchData } from './fetcher';
import { startHealthServer } from './health';
import { API_URL, API_KEY, POLL_MINUTES, COLLECTION, HEALTH_PORT } from './config';

if (!API_URL) {
  console.error('API_URL is not set. Exiting.');
  process.exit(1);
}

let lastSuccess: string | null = null;
let lastError: string | null = null;

// Adaptive polling variables
const DEFAULT_POLL_MINUTES = POLL_MINUTES;
let currentPollMinutes = DEFAULT_POLL_MINUTES;
let intervalId: NodeJS.Timeout | null = null;
let jobRunning = false;

initFirebase();
startHealthServer({ port: HEALTH_PORT, getStatus: () => ({ lastSuccess, lastError, pollMinutes: currentPollMinutes }) });

async function job() {
  if (jobRunning) {
    console.log('Previous job still running; skipping this run');
    return;
  }

  jobRunning = true;
  try {
    const data = await fetchData(API_URL, API_KEY);

    // Compute operating rides across all parks first
    let operatingCount = 0;
    for (const park of data) {
      for (const attraction of park.attractions ?? []) {
        if (attraction.status === 'OPERATING') operatingCount += 1;
      }
    }

    // If fewer than 5 rides are OPERATING, skip all persistence and increase poll interval
    if (operatingCount < 5) {
      if (currentPollMinutes !== 30) {
        currentPollMinutes = 30;
        restartInterval();
        console.log('Adjusted poll interval to 30 minutes due to low operating rides');
      }

      lastSuccess = new Date().toISOString();
      lastError = null;
      console.log(`Fetched data but skipping persistence because only ${operatingCount} rides are OPERATING`);
      return;
    }

    // Persist raw fetched payload for audit/debug (only when enough rides are operating)
    await addDocument(COLLECTION, { data, fetchedAt: new Date().toISOString() });

    // For each park, ensure park/ride firebase IDs exist (by name) and save wait times
    for (const park of data) {
      try {
        const parkName = park.parkName ?? park.parkId ?? 'unknown-park';
        const firebaseParkId = await getOrCreateParkIdByName(parkName);

        const mapped: Array<{ id: string; name?: string; status?: string; queue?: any }> = [];
        for (const attraction of park.attractions ?? []) {
          const rideName = attraction.name ?? attraction.id ?? 'unknown-ride';
          const rideId = await getOrCreateRideIdByName(firebaseParkId, rideName);
          mapped.push({ id: rideId, name: rideName, status: attraction.status, queue: attraction.queue });
        }

        await saveParkAttractionsWaits(firebaseParkId, mapped, 'themeparks.wiki');
      } catch (errPark) {
        console.error('Failed to process park', park.parkName, errPark);
      }
    }

    // Adaptive polling: if enough rides are OPERATING set poll to 15
    if (operatingCount >= 5 && currentPollMinutes !== 15) {
      currentPollMinutes = 15;
      restartInterval();
      console.log('Adjusted poll interval to 15 minutes as sufficient rides are operating');
    }

    lastSuccess = new Date().toISOString();
    lastError = null;
    console.log(new Date().toISOString(), 'Saved data successfully');
  } catch (err) {
    lastError = String(err);
    console.error('Job error:', err);
  } finally {
    jobRunning = false;
  }
}

function restartInterval() {
  if (intervalId) clearInterval(intervalId as NodeJS.Timeout);
  intervalId = setInterval(() => job(), currentPollMinutes * 60 * 1000);
  console.log('Polling interval set to', currentPollMinutes, 'minutes');
}

// Run immediately and then on interval
job();
restartInterval();
