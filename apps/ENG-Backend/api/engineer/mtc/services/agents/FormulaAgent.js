'use strict';

const BaseAgent = require('./BaseAgent');
const FormulaService = require('../FormulaService');

class FormulaAgent extends BaseAgent {
  constructor(machineName) {
    super(`FormulaAgent:${machineName}`, 8000);
    this.machineName = machineName;
  }

  async run({ partData }) {
    const result = await FormulaService.calculateMachineParams(this.machineName, partData);
    return { machineName: this.machineName, result };
  }
}

module.exports = FormulaAgent;
