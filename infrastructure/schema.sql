CREATE DATABASE IF NOT EXISTS load_shedding;
USE load_shedding;

CREATE TABLE IF NOT EXISTS pressure_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    p95 INT,
    error_rate FLOAT,
    queue_lag INT,
    state VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS shed_decisions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    priority VARCHAR(10),
    reason VARCHAR(100),
    state VARCHAR(20)
);
