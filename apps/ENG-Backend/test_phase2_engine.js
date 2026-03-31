const { findDynamicFixtures } = require('./api/engineer/mtc/logic/dynamicLogic');
const { calculateKS400B_Params } = require('./api/engineer/mtc/logic/calculationLogic');

// ชิ้นงานตัวอย่าง (OD=20, W=8, ID=10, SD~14)
const partData = {
  odBf: 20, odBfTolPlus: 0.1, odBfTolMinus: 0.05,
  idBf: 10, idBfTolPlus: 0.03, idBfTolMinus: 0.01,
  wBf: 8,  wBfTolPlus: 0.05, wBfTolMinus: 0.03,
  odAft: 20, odAftTolPlus: 0.1, odAftTolMinus: 0.05,
  idAft: 10, idTolPlus: 0.03, idTolMinus: 0.01,
  wAft: 8,  wAftTolPlus: 0.05, wAftTolMinus: 0.03,
  type: 'NORMAL', yBall: 'N', process: '', sd: 14, sdAft: 13,
};

const ks400b_calc = calculateKS400B_Params(partData);
console.log('KS400B calc sample:', { wd_A: ks400b_calc.wd_A, wd_B: ks400b_calc.wd_B, sb_A: ks400b_calc.sb_A });

const allCalcs = { ks400b: ks400b_calc };
const okFlags  = { ks400bOK: !ks400b_calc.error };

findDynamicFixtures(partData, allCalcs, okFlags).then(results => {
  console.log('\n✅ Dynamic results count:', results.length);
  results.forEach(machine => {
    console.log(`\n  Machine: ${machine.name}`);
    machine.dynamicContent.forEach(cat => {
      console.log(`    Category: ${cat.title} → Found: ${cat.dataSource.length} tools`);
      if (cat.dataSource.length > 0) {
        console.log('    Top result:', cat.dataSource[0]);
      }
    });
  });
}).catch(console.error).finally(()=>process.exit(0));
