'use strict';

const { QueueService, JobStatus } = require('../services/queue.service');

const queue = new QueueService();

// POST /analysis — queue a job and return 202 right away. The actual work
// happens in the background, so the request never waits on it.
function createAnalysis(req, res) {
  const { athlete } = req.body ?? {};

  if (typeof athlete !== 'string' || athlete.trim().length === 0) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Field "athlete" is required and must be a non-empty string.',
    });
  }

  const job = queue.enqueue(athlete.trim());

  return res.status(202).json({
    id: job.id,
    status: job.status,
    athlete: job.athlete,
    createdAt: job.createdAt,
  });
}

// GET /analysis/:id — the endpoint the client polls until the job is done.
function getAnalysis(req, res) {
  const job = queue.getJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      error: 'NotFound',
      message: `No analysis job found for id "${req.params.id}".`,
    });
  }

  return res.status(200).json(job);
}

module.exports = {
  createAnalysis,
  getAnalysis,
  queue,
  JobStatus,
};
