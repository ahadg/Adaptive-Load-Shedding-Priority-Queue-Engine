const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000';
const priorities = ['critical', 'normal', 'low'];

async function sendRequest() {
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    try {
        const res = await axios.get(`${GATEWAY_URL}/api/test`, {
            headers: { 'x-priority': priority }
        });
        console.log(`[${priority.toUpperCase()}] Status: ${res.status} - ${res.data.message || res.data.status}`);
    } catch (err) {
        if (err.response) {
            console.log(`[${priority.toUpperCase()}] Status: ${err.response.status} - ${err.response.data.message}`);
        } else {
            console.log(`[${priority.toUpperCase()}] Error: ${err.message}`);
        }
    }
}

console.log('Starting load simulation...');
setInterval(sendRequest, 500);
