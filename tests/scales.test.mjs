import test from 'node:test'
import assert from 'node:assert/strict'
import { scalePitchClasses, scaleMask } from '../src/scales.ts'
import { enumerateChords } from '../src/chords.ts'
import { sampleChords } from '../src/sampling.ts'
import { summarizeStructures, feasiblePitchClassSets } from '../src/summary.ts'
import { normalizePitchClasses, voicingInversions } from '../src/pitchStructure.ts'
import { selectedIntervals } from '../src/chordTypes.ts'
import { createAutoplay } from '../src/autoplay.ts'
const major={tonic:0,mode:'major'}
const base={voices:4,low:48,high:84,distinct:null}
function seeded() {let seed=17;return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
const pcs=notes=>[...new Set(notes.map(note=>note%12))].sort((a,b)=>a-b)

test('major and natural minor transpose seven members for all twelve tonics', () => {
  for(const [mode,offsets] of [['major',[0,2,4,5,7,9,11]],['naturalMinor',[0,2,3,5,7,8,10]]]) {
    for(let tonic=0;tonic<12;tonic++) {
      const scale={tonic,mode}
      const expected=offsets.map(offset=>(tonic+offset)%12)
      assert.deepEqual(scalePitchClasses(scale),expected)
      assert.equal(new Set(expected).size,7)
      for(let pc=0;pc<12;pc++) assert.equal(Boolean(scaleMask(scale)&(1<<pc)),expected.includes(pc))
    }
  }
  assert.equal(scaleMask(null),4095)
  assert.equal(scaleMask(),4095)
})

test('restriction off leaves counts, deterministic samples and summaries unchanged', () => {
  assert.deepEqual(enumerateChords({...base,scale:null}),enumerateChords(base))
  assert.deepEqual(sampleChords({...base,scale:null},100,null,seeded()),sampleChords(base,100,null,seeded()))
  assert.deepEqual(summarizeStructures({...base,scale:null}),summarizeStructures(base))
})

test('C major admits C major, D minor and G dominant seventh without requiring tonic', () => {
  for(const [structure,root] of [['major',0],['minor',2],['dominant7',7]]) {
    for(let inversion=0;inversion<selectedIntervals(structure).length;inversion++) {
      const constraints={...base,scale:major,structure,root,inversion}
      const result=enumerateChords(constraints)
      assert.ok(result.count>0)
      const key=normalizePitchClasses(selectedIntervals(structure)).join('–')
      for(const chord of [...result.chords,...sampleChords(constraints,100,null,seeded()),...sampleChords(constraints,20,key,seeded())]) {
        assert.ok(chord.every(note=>scalePitchClasses(major).includes(note%12)))
        assert.deepEqual(voicingInversions(chord,selectedIntervals(structure)),[inversion])
        assert.equal(pcs(chord).length,selectedIntervals(structure).length)
      }
      assert.equal(summarizeStructures(constraints)[0].pitchClassSets,1)
    }
  }
  for(const [structure,root] of [['major',2],['minor',0]]) {
    const constraints={...base,scale:major,structure,root}
    assert.equal(enumerateChords(constraints).count,0)
    assert.deepEqual(sampleChords(constraints,100),[])
    assert.deepEqual(summarizeStructures(constraints),[])
  }
  assert.ok(sampleChords({...base,scale:major,structure:'minor',root:2},20,null,seeded()).every(chord=>!pcs(chord).includes(0)))
})

test('required classes, root, range, doubling and natural minor combine independently', () => {
  const minor={tonic:9,mode:'naturalMinor'}
  assert.ok(enumerateChords({...base,scale:minor,structure:'minor',root:9}).count>0)
  const doubled=sampleChords({...base,scale:minor,structure:'minor',root:9},20,null,seeded())
  assert.ok(doubled.every(chord=>chord.length===4 && pcs(chord).length===3))
  const incompatible=[{pitchClasses:[1]},{root:1},{structure:'major',root:2},{low:49,high:49}]
  for(const change of incompatible) {
    const constraints={...base,scale:major,...change}
    assert.equal(enumerateChords(constraints).count,0)
    assert.deepEqual(feasiblePitchClassSets(constraints),[])
  }
})

test('scale-contained enumeration, complete samples and summaries match exhaustive reference', () => {
  const all=[]
  function visit(notes,start) {
    if(notes.length===3) {all.push(notes);return}
    for(let note=start;note<=62;note++) visit([...notes,note],note+1)
  }
  visit([],48)
  for(const scale of [major,{tonic:2,mode:'major'},{tonic:0,mode:'naturalMinor'}]) for(const distinct of [null,2,3]) {
    const allowed=scalePitchClasses(scale)
    const constraints={voices:3,low:48,high:62,distinct,scale,pitchClasses:[0]}
    const expected=all.filter(chord=>chord.every(note=>allowed.includes(note%12)) && pcs(chord).includes(0) && (distinct===null || pcs(chord).length===distinct))
    const result=enumerateChords(constraints)
    assert.equal(result.count,expected.length)
    assert.deepEqual(result.chords,expected.slice(0,100))
    assert.deepEqual(new Set(sampleChords(constraints,1000,null,seeded()).map(chord=>chord.join())),new Set(expected.map(chord=>chord.join())))
    const sets=new Set(expected.map(chord=>pcs(chord).join()))
    assert.deepEqual(new Set(feasiblePitchClassSets(constraints).map(set=>set.join())),sets)
    const rows=summarizeStructures(constraints)
    assert.equal(rows.reduce((sum,row)=>sum+row.pitchClassSets,0),sets.size)
    for(const row of rows) assert.ok(row.examples.every(set=>set.every(pc=>allowed.includes(pc))))
  }
  assert.equal(enumerateChords({...base,voices:6,low:0,high:127,scale:major}).count,10001)
})

test('autoplay reads updated scale and resumes after an incompatible space', () => {
  let constraints={...base,structure:'minor',root:0,scale:{tonic:0,mode:'naturalMinor'}},tick
  const played=[]
  const autoplay=createAutoplay(()=>sampleChords(constraints,1,null,seeded()),chord=>played.push(chord),()=>{},callback=>{tick=callback;return 1},()=>{})
  autoplay.start();tick()
  constraints={...constraints,scale:major};tick()
  assert.equal(played.length,1)
  constraints={...constraints,root:2};tick()
  assert.equal(played.length,2)
  assert.ok(played[1].every(note=>scalePitchClasses(major).includes(note%12)))
  autoplay.stop()
})
