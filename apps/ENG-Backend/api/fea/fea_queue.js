const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Function to generate Redis options that won't spam the console
const getRedisConnection = () => {
  const client = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false, // Prevents hanging when Redis is down
    retryStrategy: function (times) {
      // Return null to stop retrying completely. This kills the ECONNREFUSED spam.
      return null;
    }
  });

  // Suppress spammy connection refused errors completely
  client.on('error', (err) => {
      // Do nothing to keep console clean when Redis is missing
  });

  return client;
};

const connection = getRedisConnection();
const feaQueue = new Queue('fea-simulation-queue', { connection });

module.exports = {
  feaQueue,
  connection,
  getRedisConnection
};
