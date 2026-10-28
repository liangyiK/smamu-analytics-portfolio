const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('../src/core.js');
const rows=[
 {date:'2025-01-01',order:'A',customer:'X',source:'web',category:'a',amount:100,quantity:1},
 {date:'2025-01-01',order:'A',customer:'X',source:'web',category:'b',amount:200,quantity:2},
 {date:'2025-01-31',order:'B',customer:'X',source:'mail',category:'a',amount:90,quantity:1},
 {date:'2025-02-01',order:'C',customer:'Y',source:'web',category:'a',amount:50,quantity:1}];
test('line grain does not double count orders or customers',()=>assert.deepEqual(c.ecommerceSummary(rows.slice(0,3)),{sales:390,orders:2,customers:1,units:4,aov:195}));
test('inclusive end date and source/category intersection',()=>assert.equal(c.ecommerceSummary(c.filterRows(rows,{start:'2025-01-01',end:'2025-01-31',source:'web',category:'b'})).sales,200));
test('empty filter preserves null denominator',()=>assert.deepEqual(c.ecommerceSummary(c.filterRows(rows,{start:'2024-01-01',end:'2024-02-01'})),{sales:0,orders:0,customers:0,units:0,aov:null}));
test('inverted dates rejected',()=>assert.throws(()=>c.filterRows(rows,{start:'2025-02-01',end:'2025-01-01'}),/日期/));
test('unknown sentiment excluded from share denominator',()=>{const v=c.socialSummary([{label:'正面',count:2,topic:0},{label:'負面',count:1,topic:1},{label:'未知',count:3,topic:null}]);assert.equal(v.posts,6);assert.equal(v.scored,3);assert.equal(v.unknown,3);assert.equal(v.coverage,.5);assert.equal(v.shares['正面'],2/3);assert.equal(v.topics,3)});
test('empty social denominator is unknown not zero accuracy',()=>{const v=c.socialSummary([]);assert.equal(v.coverage,null);assert.equal(v.shares['負面'],null)});
test('grouping respects count weights',()=>assert.deepEqual(c.group([{platform:'PTT',count:2},{platform:'PTT',count:3},{platform:'DCARD',count:1}],'platform'),[{name:'PTT',value:5},{name:'DCARD',value:1}]));
const fs=require('node:fs'),vm=require('node:vm');const box={window:{}};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/data.js'),'utf8'),box);const data=box.window.SMAData;
test('full ecommerce release matches independently reconciled totals',()=>assert.deepEqual(c.ecommerceSummary(data.ecommerce),{sales:42268160,orders:5574,customers:2332,units:28144,aov:42268160/5574}));
test('full social release retains scored unknown and topic denominators',()=>{const v=c.socialSummary(data.social);assert.equal(v.posts,10373);assert.equal(v.scored,10279);assert.equal(v.unknown,94);assert.equal(v.topics,10278);assert.equal(v.counts['正面'],1459);assert.equal(v.counts['中性'],6985);assert.equal(v.counts['負面'],1835)});
test('exported social cells have only public aggregate columns',()=>{const allowed=['brands','count','date','label','platform','topic'];for(const r of data.social){assert.deepEqual(Object.keys(r).sort(),allowed);assert.ok(r.count>0);assert.ok(r.topic===null||(r.topic>=0&&r.topic<5));assert.ok(['正面','中性','負面','未知'].includes(r.label))}});
test('fixed RFM population and value reconcile to release',()=>{assert.equal(data.rfm.population,1750);assert.equal(data.rfm.segments.reduce((n,r)=>n+r.customers,0),1750);assert.equal(data.rfm.segments.find(r=>r.segment==='高價值活躍').customers,410);assert.equal(data.rfm.segments.find(r=>r.segment==='沉睡潛力').customers,431)});
