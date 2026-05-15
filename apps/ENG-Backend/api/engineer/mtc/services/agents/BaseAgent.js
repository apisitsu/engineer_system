'use strict';

const monitor = require('./MonitorAgent');

class BaseAgent {
  constructor(name, timeoutMs = 5000) {
    this.name      = name;
    this.timeoutMs = timeoutMs;
  }

  // Subclasses implement this — throw on error, return result on success
  async run(_input) {
    throw new Error(`${this.name}.run() not implemented`);
  }

  // Public entry point: timeout + error wrapping + latency recording
  async execute(input) {
    const start = Date.now();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${this.name} timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs
      )
    );
    try {
      const result = await Promise.race([this.run(input), timeoutPromise]);
      monitor.record(this.name, Date.now() - start);
      return result;
    } catch (err) {
      monitor.record(this.name, Date.now() - start);
      return { _agentError: true, agent: this.name, error: err.message };
    }
  }
}

module.exports = BaseAgent;
