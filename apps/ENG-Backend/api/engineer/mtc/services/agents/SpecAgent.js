'use strict';

const BaseAgent = require('./BaseAgent');
const { fetchSpecRow, mapPartData, computeDerivedFlags } = require('../partDataMapper');

class SpecAgent extends BaseAgent {
  constructor() {
    super('SpecAgent', 5000);
  }

  async run({ cnNumber }) {
    const row = await fetchSpecRow(cnNumber);
    return computeDerivedFlags(mapPartData(row));
  }
}

module.exports = SpecAgent;
