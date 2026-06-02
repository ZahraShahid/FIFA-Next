'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

const JobStatus = Object.freeze({
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

// Realistic ranges (in seconds) for each metric. Keeping them here means the
// domain rules live in one place; a real system would get these from a model.
const METRIC_THRESHOLDS = Object.freeze({
  foot_contact: { min: 0.2, max: 0.4 },
  foot_off: { min: 0.8, max: 1.3 },
  turning_point: { min: 1.1, max: 1.6 },
});

const PROCESSING_DELAY_MS = 5000;

function randomInRange(min, max) {
  const value = min + Math.random() * (max - min);
  return Math.round(value * 1000) / 1000;
}

function generateMetrics() {
  return {
    foot_contact: randomInRange(METRIC_THRESHOLDS.foot_contact.min, METRIC_THRESHOLDS.foot_contact.max),
    foot_off: randomInRange(METRIC_THRESHOLDS.foot_off.min, METRIC_THRESHOLDS.foot_off.max),
    turning_point: randomInRange(METRIC_THRESHOLDS.turning_point.min, METRIC_THRESHOLDS.turning_point.max),
  };
}

// In-memory job engine. No Redis or external broker so the project runs with
// zero setup, but it keeps the shape of a real queue: jobs are accepted right
// away, the work runs in the background, and completion is emitted as an event.
// Because storage is just a Map, swapping in a real broker/DB later is local
// to this class.
class QueueService extends EventEmitter {
  constructor({ processingDelayMs = PROCESSING_DELAY_MS } = {}) {
    super();
    this.jobs = new Map();
    this.timers = new Map();
    this.processingDelayMs = processingDelayMs;
  }

  enqueue(athlete) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const job = {
      id,
      athlete,
      status: JobStatus.PENDING,
      metrics: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    this.jobs.set(id, job);
    this.emit('job:queued', this.serialize(job));
    this.scheduleProcessing(id);

    return this.serialize(job);
  }

  // Runs the "analysis" after a delay. Pulled into its own method so the
  // background strategy (a timer now, a worker pool later) can change without
  // touching enqueue().
  scheduleProcessing(id) {
    const timer = setTimeout(() => {
      this.timers.delete(id);

      const job = this.jobs.get(id);
      if (!job) return;

      job.metrics = generateMetrics();
      job.status = JobStatus.COMPLETED;
      job.completedAt = new Date().toISOString();
      job.updatedAt = job.completedAt;

      this.emit('job:completed', this.serialize(job));
    }, this.processingDelayMs);

    // Don't keep the process alive just for a pending timer.
    timer.unref?.();
    this.timers.set(id, timer);
  }

  getJob(id) {
    const job = this.jobs.get(id);
    return job ? this.serialize(job) : null;
  }

  // Return a copy so callers can't mutate what we store.
  serialize(job) {
    return { ...job, metrics: job.metrics ? { ...job.metrics } : null };
  }

  shutdown() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

module.exports = {
  QueueService,
  JobStatus,
  METRIC_THRESHOLDS,
  generateMetrics,
};
