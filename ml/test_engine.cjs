const fs=require('node:fs'),assert=require('node:assert/strict');
const {CommentaryModel}=require('../ai/engine.js'),model=new CommentaryModel(JSON.parse(fs.readFileSync('ai/model.json')));
const fixtures=JSON.parse(fs.readFileSync('ml/reports/parity_fixtures.json'));let maxError=0;
for(const f of fixtures){const p=model.predict(f.text);for(const c of model.data.classes)maxError=Math.max(maxError,Math.abs(p.scores[c]-f.scores[c]));assert.equal(p.eligible,false);}
assert.ok(maxError<1e-9, 'Python/JS mismatch '+maxError);
const report={status:'passed',fixtures:fixtures.length,max_score_error:maxError,automatic_alerts_disabled:true};
fs.writeFileSync('ml/reports/engine_tests.json',JSON.stringify(report,null,2));console.log(report);
