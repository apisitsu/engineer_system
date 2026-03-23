/**
 * positionHelper.js
 * Position-based ordering utility for Kanban lists and cards.
 * Ported from Planka's insertToPositionables algorithm.
 *
 * Uses fractional positioning with GAP spacing to allow O(1) inserts.
 * When positions collide (gap < MIN_GAP), performs a full rebalance.
 */

const GAP = 65536;          // 2^16 — default spacing between items
const MIN_GAP = 0.125;      // minimum gap before rebalance required
const MAX_POSITION = 2 ** 50; // safety ceiling

/**
 * Find the chain of positions that are too close together,
 * starting from the end (where the new item is being inserted).
 */
function findBeginnings(positions) {
    positions.unshift(0); // add floor

    let prevPosition = positions.pop();
    const beginnings = [prevPosition];

    for (let i = positions.length - 1; i >= 0; i--) {
        const position = positions[i];
        if (prevPosition - MIN_GAP >= position) {
            break;
        }
        prevPosition = position;
        beginnings.unshift(prevPosition);
    }

    return beginnings;
}

/**
 * Try to fix collisions with minimal repositions (shift upward).
 * Returns null if positions exceed MAX_POSITION (full rebalance needed).
 */
function getRepositionsMap(positions) {
    const repositionsMap = {};

    if (positions.length <= 1) {
        if (positions[0] !== undefined && positions[0] > MAX_POSITION) {
            return null;
        }
        return repositionsMap;
    }

    let prevPosition = positions.shift();

    for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        const nextPosition = positions[i + 1];

        if (prevPosition + MIN_GAP <= position) {
            break;
        }

        if (nextPosition !== undefined && prevPosition + MIN_GAP * 2 <= nextPosition) {
            (repositionsMap[position] || (repositionsMap[position] = [])).push(
                prevPosition + (nextPosition - prevPosition) / 2,
            );
            break;
        }

        prevPosition += GAP;

        if (prevPosition > MAX_POSITION) {
            return null;
        }

        (repositionsMap[position] || (repositionsMap[position] = [])).push(prevPosition);
    }

    return repositionsMap;
}

/**
 * Full rebalance — evenly space all items with GAP intervals.
 */
function getFullRepositionsMap(positions) {
    const repositionsMap = {};

    positions.forEach((position, index) => {
        (repositionsMap[position] || (repositionsMap[position] = [])).push(GAP * (index + 1));
    });

    return repositionsMap;
}

/**
 * Main entry point.
 * Given a target position and existing records (each must have a `position` field),
 * returns the final position for the new/moved item and any repositions needed for siblings.
 *
 * @param {number} targetPosition - The desired position for the item.
 * @param {Array<{id, position}>} records - Existing sibling records sorted by position.
 * @returns {{ position: number, repositions: Array<{record, position}> }}
 */
function insertToPositionables(targetPosition, records) {
    const lowers = [];
    const uppers = [];

    records.forEach((record) => {
        (record.position <= targetPosition ? lowers : uppers).push(record.position);
    });

    const beginnings = findBeginnings([...lowers, targetPosition]);

    const repositionsMap =
        getRepositionsMap([...beginnings, ...uppers]) ||
        getFullRepositionsMap([...lowers, targetPosition, ...uppers]);

    const position = repositionsMap[targetPosition]
        ? repositionsMap[targetPosition].pop()
        : targetPosition;

    const repositions = [];

    for (let i = records.length - 1; i >= 0; i--) {
        const record = records[i];
        if (!repositionsMap[record.position] || repositionsMap[record.position].length === 0) {
            continue;
        }
        repositions.unshift({
            record,
            position: repositionsMap[record.position].pop(),
        });
    }

    return { position, repositions };
}

/**
 * Calculate midpoint position between two neighbors for drag & drop.
 * Returns the position that should be used when moving an item between two siblings.
 *
 * @param {number|null} prevPosition - Position of the item above (null if inserting at top)
 * @param {number|null} nextPosition - Position of the item below (null if inserting at bottom)
 * @returns {number}
 */
function calcMidPosition(prevPosition, nextPosition) {
    if (prevPosition === null && nextPosition === null) return GAP;
    if (prevPosition === null) return nextPosition / 2;
    if (nextPosition === null) return prevPosition + GAP;
    return prevPosition + (nextPosition - prevPosition) / 2;
}

module.exports = {
    GAP,
    MIN_GAP,
    insertToPositionables,
    calcMidPosition,
};
