require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const Redis = require('ioredis');
const { Queue } = require('bullmq');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const requestQueue = new Queue('requests', { connection: redis });

const PRESSURE_STATES = {
    NORMAL: 'NORMAL',
    DEGRADED: 'DEGRADED',
    CRITICAL: 'CRITICAL',
};

const PRIORITIES = {
    CRITICAL: 'critical',
    NORMAL: 'normal',
    LOW: 'low',
};

// Strategy Matrix
const STRATEGY = {
    [PRESSURE_STATES.NORMAL]: {
        [PRIORITIES.CRITICAL]: 'allow',
        [PRIORITIES.NORMAL]: 'allow',
        [PRIORITIES.LOW]: 'allow',
    },
    [PRESSURE_STATES.DEGRADED]: {
        [PRIORITIES.CRITICAL]: 'allow',
        [PRIORITIES.NORMAL]: 'queue',
        [PRIORITIES.LOW]: 'shed',
    },
    [PRESSURE_STATES.CRITICAL]: {
        [PRIORITIES.CRITICAL]: 'allow',
        [PRIORITIES.NORMAL]: 'shed',
        [PRIORITIES.LOW]: 'shed',
    },
};

fastify.get('/health', async () => {
    return { status: 'ok' };
});

fastify.all('/api/*', async (request, reply) => {
    const priority = request.headers['x-priority'] || PRIORITIES.NORMAL;
    const state = await redis.get('pressure_state') || PRESSURE_STATES.NORMAL;

    const action = STRATEGY[state]?.[priority] || 'allow';

    // Metrics (Simple counters in Redis)
    await redis.hincrby('metrics:requests_total', `${priority}:${state}`, 1);

    if (action === 'shed') {
        await redis.hincrby('metrics:requests_shed_total', `${priority}:shed`, 1);
        return reply.code(429).send({
            error: 'Too Many Requests',
            message: 'System is under high pressure. Request shed.',
            priority,
            state,
        });
    }

    if (action === 'queue') {
        const job = await requestQueue.add('process-request', {
            method: request.method,
            url: request.url,
            body: request.body,
            headers: request.headers,
            priority,
        });

        return reply.code(202).send({
            message: 'Request queued due to system pressure',
            jobId: job.id,
            priority,
            state,
        });
    }

    // Action is 'allow'
    // In a real system, we would proxy or process here.
    // For demo, we just simulate success.
    return {
        status: 'success',
        data: 'Request processed immediately',
        priority,
        state,
    };
});

const start = async () => {
    try {
        await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
        console.log(`Gateway running at http://localhost:${process.env.PORT || 3000}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
