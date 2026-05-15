'use strict';

// Rolling-window latency tracker — singleton, shared across all agents.
// Keeps last `windowSize` measurements per agent name.
class MonitorAgent {
  constructor(windowSize = 100) {
    this._data = new Map();
    this._windowSize = windowSize;
  }

  record(agentName, durationMs) {
    if (!this._data.has(agentName)) this._data.set(agentName, []);
    const arr = this._data.get(agentName);
    arr.push(durationMs);
    if (arr.length > this._windowSize) arr.shift();
  }

  getStats(agentName) {
    const arr = this._data.get(agentName) || [];
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const avg    = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    return {
      count: arr.length,
      avg:   Math.round(avg),
      p95:   sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
      max:   sorted[sorted.length - 1],
    };
  }

  getAllStats() {
    const result = {};
    for (const [name] of this._data) result[name] = this.getStats(name);
    return result;
  }

  // Returns names of agents with avg latency above thresholdMs
  slowAgents(thresholdMs = 2000) {
    return Object.entries(this.getAllStats())
      .filter(([, s]) => s && s.avg > thresholdMs)
      .map(([name, s]) => ({ name, ...s }));
  }
}

module.exports = new MonitorAgent();
