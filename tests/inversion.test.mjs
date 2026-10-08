import test from 'node:test'
import assert from 'node:assert/strict'
import { enumerateChords } from '../src/chords.ts'
import { voicingInversions, normalizePitchClasses, inversionLabel } from '../src/pitchStructure.ts'
import { feasiblePitchClassSets, summarizeStructures } from '../src/summary.ts'
import { sampleChords } from '../src/sampling.ts'
import { createAutoplay } from '../src/autoplay.ts'

const base={voices:4,low:48,high:84,distinct:3,pitchClasses:[0,4,7],structure:'major'}
function seeded() { let seed=17; return () => {seed=(seed*1664525+1013904223)>>>0;return seed/4294967296} }
const setKey=notes=>[...new Set(notes.map(n=>n%12))].sort((a,b)=>a-b).join(',')

test('bass member gives root, first and second inversions independent of doubling and ordering', () => {
  for (const [notes,expected] of [[[48,55,64,72],0],[[52,60,67,76],1],[[55,60,64,79],2]]) {
    assert.deepEqual(voicingInversions(notes),[expected])
    assert.deepEqual(voicingInversions([...notes].reverse()),[expected])
    for(let shift=0;shift<12;shift++) assert.deepEqual(voicingInversions(notes.map(note=>note+shift)),[expected])
  }
  assert.deepEqual(voicingInversions([51,60,67]),[1]) // E-flat bass in C minor
})

test('arbitrary structures support all members; symmetric references remain transposition-consistent', () => {
  assert.deepEqual(normalizePitchClasses([0,1,3,7]),[0,1,3,7])
  for(const [bass,member] of [[48,0],[49,1],[51,2],[55,3]]) {
    const upper=[60,61,63,67]
    assert.deepEqual(voicingInversions([bass,...upper]),[member])
  }
  for(let shift=0;shift<12;shift++) {
    assert.deepEqual(new Set(voicingInversions([48,52,56].map(n=>n+shift))),new Set([0,1,2]))
  }
  assert.deepEqual([0,1,2,3,4,5,6,7].map(inversionLabel),['Root','1st','2nd','3rd','4th','5th','6th','7th'])
})

test('enumeration and bounded samples compose with all constraints and Any preserves behavior', () => {
  assert.deepEqual(enumerateChords({...base,inversion:null}),enumerateChords(base))
  for(const inversion of [0,1,2]) {
    const constraints={...base,inversion}
    const counted=enumerateChords(constraints)
    assert.ok(counted.count>0)
    for(const chord of counted.chords) assert.deepEqual(voicingInversions(chord),[inversion])
    for(const [limit,structure] of [[100,null],[20,'0–4–7'],[1,null]]) {
      const sample=sampleChords(constraints,limit,structure,seeded())
      assert.equal(sample.length,Math.min(limit,counted.count))
      for(const chord of sample) {
        assert.deepEqual(voicingInversions(chord),[inversion])
        assert.equal(chord.length,4)
        assert.equal(setKey(chord),'0,4,7')
        assert.ok(chord.every(note=>note>=48 && note<=84))
      }
    }
  }
  const impossible={...base,voices:3,high:55,inversion:1}
  assert.equal(enumerateChords(impossible).count,0)
  assert.deepEqual(feasiblePitchClassSets(impossible),[])
  assert.deepEqual(sampleChords(impossible,100),[])
  for(const inversion of [-1,3,1.5]) assert.equal(enumerateChords({...base,inversion}).count,0)
  assert.equal(enumerateChords({...base,structure:'minor',inversion:0}).count,0)
  assert.equal(enumerateChords({...base,low:0,high:127,voices:5,inversion:1}).count,10001)
})

test('summary feasibility, complete small samples and counts match exhaustive concrete voicings', () => {
  const all=[]
  function visit(notes,start) {
    if(notes.length===4) {all.push(notes);return}
    for(let n=start;n<=60;n++) visit([...notes,n],n+1)
  }
  visit([],48)
  for(const distinct of [null,3,4]) for(const inversion of [0,1,2,3]) {
    const constraints={voices:4,low:48,high:60,distinct,pitchClasses:[0],inversion}
    const expected=all.filter(chord=>chord.some(n=>n%12===0) && (distinct===null || new Set(chord.map(n=>n%12)).size===distinct) && voicingInversions(chord).includes(inversion))
    const counted=enumerateChords(constraints)
    assert.equal(counted.count,expected.length)
    assert.deepEqual(counted.chords,expected.slice(0,100))
    const expectedSets=new Set(expected.map(setKey))
    assert.deepEqual(new Set(feasiblePitchClassSets(constraints).map(pcs=>pcs.join(','))),expectedSets)
    const rows=summarizeStructures(constraints)
    assert.equal(rows.reduce((sum,row)=>sum+row.pitchClassSets,0),expectedSets.size)
    for(const row of rows) for(const pcs of row.examples) assert.ok(expectedSets.has(pcs.join(',')))
    const sample=sampleChords(constraints,1000,null,seeded())
    assert.deepEqual(new Set(sample.map(chord=>chord.join(','))),new Set(expected.map(chord=>chord.join(','))))
  }
})

test('autoplay uses updated inversion constraints through the shared sampler', () => {
  let tick, constraints={...base,inversion:0}
  const played=[]
  const autoplay=createAutoplay(()=>sampleChords(constraints,1,null,seeded()),chord=>played.push(chord),()=>{},callback=>{tick=callback;return 1},()=>{})
  autoplay.start()
  tick()
  constraints={...base,inversion:2}
  tick()
  assert.deepEqual(played.map(notes=>voicingInversions(notes)),[[0],[2]])
  autoplay.stop()
})
