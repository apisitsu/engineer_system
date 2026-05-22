/**
 * CAD Generation Queue — BullMQ + Redis Setup
 * Mirrors the proven pattern from api/fea/fea_queue.js
 */
const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Function to generate Redis options that won't spam the console
const getRedisConnection = () => {
  const client = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    retryStrategy: function (times) {
      // Retry exponentially up to every 10 seconds to allow auto-reconnect
      return Math.min(times * 1000, 10000);
    }
  });

  // Suppress spammy connection refused errors completely
  client.on('error', (err) => {
    // Do nothing to keep console clean when Redis is missing
  });

  return client;
};

const connection = getRedisConnection();
const cadQueue = new Queue('cad-generation-queue', { connection });

module.exports = {
  cadQueue,
  connection,
  getRedisConnection
};
