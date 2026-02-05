require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const Redis = require('ioredis');
const cors = require('@fastify/cors');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

fastify.register(cors);

// Get current system state and metrics
fastify.get('/api/stats', async () => {
    const state = await redis.get('pressure_state') || 'NORMAL';
    const override = await redis.get('pressure_override');

    const requests_total = await redis.hgetall('metrics:requests_total');
    const requests_shed = await redis.hgetall('metrics:requests_shed_total');
    const requests_processed = await redis.hgetall('metrics:requests_processed_total');

    return {
        state,
        override: override || 'none',
        metrics: {
            requests_total,
            requests_shed,
            requests_processed,
        }
    };
});

// Manual override for pressure state
fastify.post('/api/override', async (request, reply) => {
    const { state } = request.body; // NORMAL, DEGRADED, CRITICAL, or null to clear

    if (!state) {
        await redis.del('pressure_override');
        await redis.del('pressure_state'); // Let analyzer set it again
        return { status: 'cleared override' };
    }

    if (['NORMAL', 'DEGRADED', 'CRITICAL'].includes(state)) {
        await redis.set('pressure_override', state);
        await redis.set('pressure_state', state); // Immediate effect
        return { status: 'override set', state };
    }

    return reply.code(400).send({ error: 'Invalid state' });
});

const start = async () => {
    try {
        await fastify.listen({ port: process.env.DASHBOARD_PORT || 4000, host: '0.0.0.0' });
        console.log(`Dashboard API running at http://localhost:${process.env.DASHBOARD_PORT || 4000}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
