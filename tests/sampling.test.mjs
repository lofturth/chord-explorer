import test from 'node:test'
import assert from 'node:assert/strict'
import { sampleChords } from '../src/sampling.ts'
import { normalizePitchClasses, summarizeStructures, availableSelection, orderSummaryRows } from '../src/summary.ts'
import { enumerateChords } from '../src/chords.ts'
const base = {voices:4, low:0, high:127, distinct:null}
function seeded() { let seed=17; return () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296 } }
test('common-first presentation keeps every row and normal ordering within groups', () => {
  const normal=summarizeStructures(base)
  const original=[...normal]
  assert.equal(normal[0].intervals.join('–'),'0')
  assert.equal(orderSummaryRows(normal,false),normal)
  const common=orderSummaryRows(normal,true)
  assert.deepEqual(common.slice(0,2).map(row=>row.type),['Minor triad','Major triad'])
  assert.deepEqual(common.filter(row=>row.type==='—'),normal.filter(row=>row.type==='—'))
  assert.deepEqual(new Set(common),new Set(normal))
  assert.deepEqual(normal,original)
  assert.equal(availableSelection('0–4–7',common),availableSelection('0–4–7',normal))
})
test('inspection samples satisfy selected structure and all global constraints', () => {
  for (const constraints of [base,{...base,structure:'major'},{...base,low:48,high:84,distinct:3,pitchClasses:[0,4,7]}]) {
    const sampled=sampleChords(constraints,20,'0–4–7',seeded())
    assert.equal(sampled.length,20)
    assert.equal(new Set(sampled.map(n=>n.join())).size,20)
    for (const notes of sampled) {
      assert.equal(notes.length,constraints.voices)
      assert.ok(notes.every(n=>n>=constraints.low && n<=constraints.high))
      assert.equal(new Set(notes).size,notes.length)
      const pcs=[...new Set(notes.map(n=>n%12))]
      assert.equal(normalizePitchClasses(pcs).join('–'),'0–4–7')
      if(constraints.pitchClasses) assert.deepEqual(pcs.sort((a,b)=>a-b),constraints.pitchClasses)
    }
  }
  assert.deepEqual(sampleChords({...base,structure:'minor'},20,'0–4–7'),[])
})
test('general samples are capped, varied and not the enumeration prefix', () => {
  const sample=sampleChords(base,100,null,seeded())
  assert.equal(sample.length,100)
  assert.notDeepEqual(sample,enumerateChords(base).chords)
  assert.ok(new Set(sample.map(notes=>Math.floor(notes[0]/12))).size>4)
  assert.ok(sample.some(notes=>notes[0]>60))
})
test('small spaces display all unique voicings and zero produces none', () => {
  const small={voices:3,low:48,high:60,distinct:3,pitchClasses:[0,4,7],structure:'major'}
  assert.deepEqual(sampleChords(small,20,'0–4–7',seeded()).sort(),enumerateChords(small).chords.sort())
  assert.deepEqual(sampleChords({...small,voices:2},100),[])
})
test('unavailable row selection clears after a constraint change', () => {
  assert.equal(availableSelection('0–4–7',summarizeStructures(base)),'0–4–7')
  assert.equal(availableSelection('0–4–7',summarizeStructures({...base,structure:'minor'})),null)
})
