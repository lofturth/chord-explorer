import test from 'node:test'
import assert from 'node:assert/strict'
import { enumerateChords } from '../src/chords.ts'
import { structuralRoot, voicingInversions } from '../src/pitchStructure.ts'
import { feasiblePitchClassSets, summarizeStructures } from '../src/summary.ts'
import { sampleChords } from '../src/sampling.ts'
import { createAutoplay } from '../src/autoplay.ts'
const base={voices:4,low:48,high:84,distinct:3,structure:'major'}
const pcs=notes=>[...new Set(notes.map(n=>n%12))].sort((a,b)=>a-b)
function seeded() {let seed=17;return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}

test('fixed C and D major roots preserve harmonic pitches, doubling and every inversion', () => {
  for(const root of [0,2]) for(const inversion of [null,0,1,2]) {
    const constraints={...base,root,inversion}
    const expected=[root,(root+4)%12,(root+7)%12].sort((a,b)=>a-b)
    const result=enumerateChords(constraints)
    assert.ok(result.count>0)
    for(const chord of [...result.chords,...sampleChords(constraints,100,null,seeded()),...sampleChords(constraints,20,'0–4–7',seeded())]) {
      assert.equal(chord.length,4)
      assert.deepEqual(pcs(chord),expected)
      assert.equal(structuralRoot(pcs(chord)),root)
      if(inversion!==null) assert.deepEqual(voicingInversions(chord),[inversion])
    }
    const rows=summarizeStructures(constraints)
    assert.equal(rows.length,1)
    assert.equal(rows[0].pitchClassSets,1)
    assert.equal(rows[0].type,'Major triad')
    assert.deepEqual(rows[0].examples,[expected])
  }
  for(const notes of [[62,66,74,81],[54,57,62,74],[57,62,66,69]]) assert.equal(structuralRoot(pcs(notes)),2)
  assert.equal(structuralRoot(pcs([60,64,67,72])),0)
})

test('required pitch classes remain independent and incompatible root combinations are empty', () => {
  assert.ok(enumerateChords({...base,root:2,pitchClasses:[6]}).count>0)
  for(const changes of [{pitchClasses:[0]},{low:48,high:60},{voices:2},{distinct:2},{inversion:3},{root:12},{root:-1},{root:1.5}]) {
    const constraints={...base,root:2,...changes}
    assert.equal(enumerateChords(constraints).count,0)
    assert.deepEqual(sampleChords(constraints,100),[])
    assert.deepEqual(summarizeStructures(constraints),[])
  }
})

test('unique arbitrary references transpose; ambiguous symmetric sets require Root Any', () => {
  for(let root=0;root<12;root++) {
    const set=[0,1,3,7].map(n=>(root+n)%12)
    assert.equal(structuralRoot(set),root)
    const constraints={voices:4,low:48,high:84,distinct:4,pitchClasses:set,root}
    assert.ok(enumerateChords(constraints).count>0)
    assert.equal(feasiblePitchClassSets(constraints).length,1)
    assert.ok(sampleChords(constraints,20,null,seeded()).every(chord=>structuralRoot(pcs(chord))===root))
  }
  const symmetric={voices:3,low:48,high:72,distinct:3,pitchClasses:[0,4,8]}
  assert.equal(structuralRoot([0,4,8]),null)
  assert.equal(structuralRoot([0,6]),null)
  assert.ok(enumerateChords(symmetric).count>0)
  assert.deepEqual(enumerateChords({...symmetric,root:null}),enumerateChords(symmetric))
  for(let root=0;root<12;root++) {
    assert.equal(enumerateChords({...symmetric,root}).count,0)
    assert.deepEqual(feasiblePitchClassSets({...symmetric,root}),[])
  }
})

test('counts, summary feasibility and complete small samples agree with exhaustive voicings', () => {
  const all=[]
  function visit(notes,start) {
    if(notes.length===3) {all.push(notes);return}
    for(let n=start;n<=62;n++) visit([...notes,n],n+1)
  }
  visit([],48)
  for(const root of [0,2,7]) for(const inversion of [null,0,1,2]) {
    const constraints={voices:3,low:48,high:62,distinct:null,pitchClasses:[0],root,inversion}
    const expected=all.filter(chord=>chord.some(n=>n%12===0) && structuralRoot(pcs(chord))===root && (inversion===null || voicingInversions(chord).includes(inversion)))
    const result=enumerateChords(constraints)
    assert.equal(result.count,expected.length)
    assert.deepEqual(result.chords,expected.slice(0,100))
    assert.deepEqual(new Set(sampleChords(constraints,1000,null,seeded()).map(n=>n.join())),new Set(expected.map(n=>n.join())))
    const sets=new Set(expected.map(chord=>pcs(chord).join()))
    assert.deepEqual(new Set(feasiblePitchClassSets(constraints).map(set=>set.join())),sets)
    assert.equal(summarizeStructures(constraints).reduce((sum,row)=>sum+row.pitchClassSets,0),sets.size)
  }
  assert.equal(enumerateChords({...base,voices:6,low:0,high:127,root:2}).count,10001)
})

test('autoplay follows updated root and inversion through existing shared sampling', () => {
  let constraints={...base,root:2,inversion:1},tick
  const played=[]
  const autoplay=createAutoplay(()=>sampleChords(constraints,1,null,seeded()),chord=>played.push(chord),()=>{},callback=>{tick=callback;return 1},()=>{})
  autoplay.start();tick()
  constraints={...base,root:0,inversion:2};tick()
  constraints={...base,root:2,pitchClasses:[0]};tick()
  assert.equal(played.length,2)
  assert.deepEqual(played.map(chord=>structuralRoot(pcs(chord))),[2,0])
  assert.deepEqual(played.map(notes=>voicingInversions(notes)),[[1],[2]])
  autoplay.stop()
})
