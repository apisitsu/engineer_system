'use strict';

function calculateSD(part) {
  const SD = part.yBall === 'Y' ? part.sd : part.sdAft;
  if (!SD || isNaN(SD) || SD <= 0) return null;
  return SD;
}

module.exports = { calculateSD };
