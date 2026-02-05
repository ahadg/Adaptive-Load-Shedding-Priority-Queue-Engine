# Adaptive Load Shedding & Priority Queue Engine

A smart traffic control system that protects downstream services during high load.

## Microservices

1. **Traffic Gateway** (Port 3000): Entry point. Applies shedding/queuing.
2. **Pressure Analyzer**: Monitors health and updates system state.
3. **Adaptive Queue Processor**: Processes deferred requests based on priority.
4. **Dashboard API** (Port 4000): Observability and manual override.

## Tech Stack

- **Runtime**: Node.js + Fastify
- **State/Queue**: Redis + BullMQ
- **Storage**: MySQL (snapshots)
- **Events**: Kafka (signals)

## Pressure Logic

| Pressure State | Critical | Normal | Low |
| :--- | :--- | :--- | :--- |
| **NORMAL** | Allow | Allow | Allow |
| **DEGRADED** | Allow | Queue | Shed |
| **CRITICAL** | Allow | Shed | Shed |

## How to Run

### 1. Start Infrastructure
If you have Docker installed:
```bash
docker-compose -f infrastructure/docker-compose.yml up -d
```
Otherwise, ensure Redis is running at `localhost:6379`.

### 2. Install Dependencies
```bash
# In each directory (gateway, analyzer, processor, dashboard)
npm install
```

### 3. Start Services
Open 4 terminals and run:
```bash
# Terminal 1
cd gateway && node index.js

# Terminal 2
cd analyzer && node index.js

# Terminal 3
cd processor && node index.js

# Terminal 4
cd dashboard && node index.js
```

### 4. Test Load
```bash
node scripts/test-load.js
```

### 5. Control Plane
- Get Stats: `GET http://localhost:4000/api/stats`
- Set Override: `POST http://localhost:4000/api/override` with body `{"state": "CRITICAL"}`
