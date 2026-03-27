/**
 * Group matches by machine, sort by closeness (_diff), take top N.
 */
function topNPerMachine(matches, n) {
  const groups = {};
  matches.forEach(m => {
    if (!groups[m.machine]) groups[m.machine] = [];
    groups[m.machine].push(m);
  });

  const result = [];
  Object.keys(groups).sort().forEach(machine => {
    groups[machine].sort((a, b) => a._diff - b._diff);
    const top = groups[machine].slice(0, n);
    top.forEach(item => {
      const { _diff, ...rest } = item;
      result.push(rest);
    });
  });
  return result;
}