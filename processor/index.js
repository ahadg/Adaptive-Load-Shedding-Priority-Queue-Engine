require('dotenv').config();
const { Worker } = require('bullmq');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const worker = new Worker('requests', async job => {
    const { priority, url } = job.data;
    console.log(`[Processor] Processing ${priority} request: ${url}`);

    // Simulate variable processing time based on priority
    // High priority might get more resources/faster processing in a real system
    const delay = Math.floor(Math.random() * 500) + 100;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Update metrics
    await redis.hincrby('metrics:requests_processed_total', `${priority}`, 1);

    return { status: 'completed', processedAt: Date.now() };
}, {
    connection: redis,
    concurrency: 5, // Can be made dynamic
});

worker.on('completed', job => {
    console.log(`[Processor] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[Processor] Job ${job.id} failed: ${err.message}`);
});

console.log('Processor started, waiting for jobs...');
