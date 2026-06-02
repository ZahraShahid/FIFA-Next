# FIFA Next — Biomechanics Analysis

A small full-stack demo of an async job pattern: submit an athlete's name, the
backend accepts it instantly and runs a 5-second mock analysis in the
background, and the Angular UI polls until the results are ready.

## Prerequisites

- **Node.js v18+** and npm

## Setup & run

**Backend** (http://localhost:3000)

```bash
cd backend
npm install
npm start
```

**Frontend** (http://localhost:4200)

```bash
cd frontend
npm install
npm start
```

Open http://localhost:4200, type an athlete name, and click **Analyze**. You'll
see a spinner while it processes, then a results panel with the metrics.

## API

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/analysis` | Body `{ "athlete": "Name" }`. Returns `202` with the job `id` and `status: PENDING`. |
| `GET` | `/analysis/:id` | Returns the current job; poll until `status` is `COMPLETED`. |

Metrics are returned in realistic ranges (seconds): `foot_contact` 0.20–0.40,
`foot_off` 0.80–1.30, `turning_point` 1.10–1.60.

## How it's built

- **Backend** — Express with a small in-memory queue (`QueueService`) that
  accepts jobs, runs the work on a timer, and exposes job state for polling. No
  Redis or external services needed to run it.
- **Frontend** — A single Angular component. Polling is done with RxJS
  (`interval` → `switchMap` → `takeWhile`), and subscriptions are cleaned up in
  `ngOnDestroy`.

The frontend is written in plain Angular, which matches the working stack
directly. Because all the logic lives in the component and RxJS streams rather
than the markup, the same code drops into an Ionic/Capacitor app for iOS and
Android with only the template tags changing. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the scaling and mobile plan.
