// Calls the closing service on a timer. No business rules live here.
const closingService = require('../services/closingService');

let timer = null;
let running = false;

async function tick() {
  if (running) return; // never overlap two runs
  running = true;
  try {
    const r = await closingService.runOnce(new Date());
    if (r.activated || r.sold || r.unsold) {
      console.log(`[closer] activated=${r.activated} sold=${r.sold} unsold=${r.unsold}`);
    }
  } catch (err) {
    console.error('[closer] failed:', err.message);
  } finally {
    running = false;
  }
}

function start(intervalMs) {
  if (timer) return;
  tick();
  timer = setInterval(tick, intervalMs);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
