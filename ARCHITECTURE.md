# Architecture Notes — FIFA Next

This prototype shows the core pattern: accept a request instantly, do the slow
work in the background, and let the client poll for the result. Here's how that
grows into something production-ready.

## 1. Handling lots of videos (AWS S3 + SQS)

Right now jobs live in memory. That's fine for a demo but won't survive a
restart or scale past one server. The real version:

- **Don't send video through the API.** The API hands back a temporary upload
  link (a pre-signed S3 URL) and the client uploads the file straight to S3.
  This keeps big files off our servers.
- **Use a real queue.** When an upload finishes, S3 drops a message on **SQS**.
  This replaces the in-memory `EventEmitter` we use today.
- **Separate workers do the analysis.** A set of worker processes read jobs off
  SQS, run the analysis, and save results to a database. The API stays small
  and fast; workers scale up when the queue gets busy and down when it's quiet.
- **The polling endpoint doesn't change.** `GET /analysis/:id` still works the
  same way — it just reads job state from the database instead of memory.

## 2. Reusing this on mobile (Ionic + Capacitor)

The frontend is plain Angular on purpose, because that code moves to mobile
almost untouched:

- **Same logic, different tags.** Components, the `HttpClient` service, and the
  RxJS polling stream stay exactly as they are. Only the HTML changes —
  `<input>` becomes `<ion-input>`, `<button>` becomes `<ion-button>`.
- **Capacitor reaches the hardware.** Wrapping the app with Capacitor gives
  access to the device camera and file storage to record and hold a clip
  before uploading it.
- **Works offline.** Captured jobs and pending uploads are saved locally in
  **SQLite**. If there's no connection, they queue on the device and upload
  automatically once the network is back.

## 3. Path to production (4 phases)

1. **Make it real** — replace the in-memory store with a database and SQS, add
   input validation, login/auth, and logging.
2. **Plug in the real model** — swap the random numbers for the actual
   biomechanics analysis and check its output against lab measurements.
3. **Make it sturdy** — auto-scaling workers, retries for failed jobs, and a
   load test to confirm it handles the target volume.
4. **Ship it** — automated deploys, monitoring/alerts, a security pass, and the
   mobile build.

## 4. First 90 days

| Window | Focus |
| --- | --- |
| **Days 1–30** | Database + SQS queue, auth, validation, and the S3 upload flow working end to end. |
| **Days 31–60** | Real analysis model integrated and accuracy-checked; auto-scaling workers and monitoring. |
| **Days 61–90** | Ionic/Capacitor mobile app with offline SQLite; load-tested and launched. |
