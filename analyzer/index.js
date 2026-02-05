require('dotenv').config();
const Redis = require('ioredis');
const mysql = require('mysql2/promise');
const { Kafka } = require('kafkajs');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Mock state for simulation
let metrics = {
    p95: 50,
    error_rate: 0.01,
    queue_lag: 0,
};

// Simulation: Randomly fluctuate metrics
setInterval(() => {
    metrics.p95 = Math.floor(Math.random() * 600);
    metrics.error_rate = Math.random() * 0.2;
    metrics.queue_lag = Math.floor(Math.random() * 100);
}, 5000);

async function determineState(stats) {
    if (stats.p95 > 500 || stats.error_rate > 0.15) return 'CRITICAL';
    if (stats.p95 > 200 || stats.error_rate > 0.05) return 'DEGRADED';
    return 'NORMAL';
}

async function start() {
    let db;
    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'load_shedding',
        });
        console.log('Connected to MySQL');
    } catch (err) {
        console.warn('MySQL not available, skipping persistent storage:', err.message);
    }

    const kafka = new Kafka({
        clientId: 'pressure-analyzer',
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    });
    const producer = kafka.producer();

    try {
        await producer.connect();
        console.log('Connected to Kafka');
    } catch (err) {
        console.warn('Kafka not available, skipping event emission:', err.message);
    }

    setInterval(async () => {
        // Respect manual override
        const override = await redis.get('pressure_override');
        const state = override || await determineState(metrics);
        console.log(`Current State: ${state} ${override ? '(OVERRIDE)' : ''} (p95: ${metrics.p95}ms, error: ${(metrics.error_rate * 100).toFixed(2)}%)`);

        // Update Redis
        await redis.set('pressure_state', state);

        // Store snapshot in MySQL
        if (db) {
            try {
                await db.execute(
                    'INSERT INTO pressure_snapshots (ts, p95, error_rate, queue_lag, state) VALUES (NOW(), ?, ?, ?, ?)',
                    [metrics.p95, metrics.error_rate, metrics.queue_lag, state]
                );
            } catch (err) {
                console.error('Failed to store snapshot:', err.message);
            }
        }

        // Emit via Kafka
        try {
            await producer.send({
                topic: 'system-pressure',
                messages: [{ value: JSON.stringify({ state, ...metrics, ts: Date.now() }) }],
            });
        } catch (err) {
            // Kafka might be down
        }
    }, 3000);
}

start();
