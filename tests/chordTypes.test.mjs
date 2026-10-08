import test from 'node:test'
import assert from 'node:assert/strict'
import { chordTypes, selectedIntervals, structures } from '../src/chordTypes.ts'
import { enumerateChords } from '../src/chords.ts'
import { structuralRoot, voicingInversions, normalizePitchClasses } from '../src/pitchStructure.ts'
import { summarizeStructures, feasiblePitchClassSets } from '../src/summary.ts'
import { sampleChords } from '../src/sampling.ts'
import { createAutoplay } from '../src/autoplay.ts'
const base={voices:4,low:48,high:95,distinct:null}
const pcs=notes=>[...new Set(notes.map(n=>n%12))].sort((a,b)=>a-b)
function seeded() {let seed=17;return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
const expectedTypes={
 diminished:['Diminished triad',[0,3,6]], augmented:['Augmented triad',[0,4,8]],
 sus2:['Sus2',[0,2,7]], sus4:['Sus4',[0,5,7]],
 dominant7:['Dominant 7th',[0,4,7,10]], major7:['Major 7th',[0,4,7,11]], minor7:['Minor 7th',[0,3,7,10]],
}

test('all added vocabulary entries share their root-relative intervals and mathematical summary labels', () => {
  assert.equal(Object.keys(chordTypes).length,9)
  for(const [structure,[label,intervals]] of Object.entries(expectedTypes)) {
    assert.equal(chordTypes[structure].label,label)
    assert.deepEqual(selectedIntervals(structure),intervals)
    assert.equal(structures[structure],intervals.join('–'))
    const rows=summarizeStructures({...base,structure})
    assert.equal(rows.length,1)
    assert.deepEqual(rows[0].intervals,normalizePitchClasses(intervals))
    assert.equal(rows[0].type,structure.startsWith('sus')?'Sus2 / Sus4':label)
    assert.equal(rows[0].pitchClassSets,structure==='augmented'?4:12)
  }
})

test('each unambiguous type transposes with correct fixed-root pitches and ordered inversions', () => {
  for(const [structure,{intervals}] of Object.entries(chordTypes)) {
    if(structure==='augmented') continue
    for(let root=0;root<12;root++) for(let inversion=0;inversion<intervals.length;inversion++) {
      const expected=intervals.map(i=>(root+i)%12).sort((a,b)=>a-b)
      const constraints={...base,structure,root,inversion,pitchClasses:expected,distinct:intervals.length}
      const result=enumerateChords(constraints)
      assert.ok(result.count>0,`${structure} root ${root} inversion ${inversion}`)
      const sampled=sampleChords(constraints,5,null,seeded())
      for(const chord of [...result.chords,...sampled]) {
        assert.deepEqual(pcs(chord),expected)
        assert.equal(chord[0]%12,(root+intervals[inversion])%12)
        assert.equal(structuralRoot(pcs(chord),intervals),root)
        assert.deepEqual(voicingInversions(chord,intervals),[inversion])
      }
      const unrestrictedRoot={...constraints,root:null}
      assert.equal(enumerateChords(unrestrictedRoot).count,result.count)
      const unrooted=sampleChords(unrestrictedRoot,5,null,seeded())
      assert.ok(unrooted.every(chord=>chord[0]%12===(root+intervals[inversion])%12))
    }
  }
})

test('suspended and seventh interpretation differs intentionally from mathematical grouping', () => {
  const notes=[60,65,67]
  assert.deepEqual(voicingInversions(notes,selectedIntervals('sus4')),[0])
  assert.deepEqual(voicingInversions(notes,selectedIntervals('sus2')),[2])
  assert.equal(structuralRoot(pcs(notes),selectedIntervals('sus4')),0)
  assert.equal(structuralRoot(pcs(notes),selectedIntervals('sus2')),5)
  assert.equal(structuralRoot(pcs(notes)),5) // Any retains original normalization.
  for(const structure of ['dominant7','major7','minor7']) {
    const intervals=selectedIntervals(structure)
    assert.notDeepEqual(normalizePitchClasses(intervals),intervals)
    const rows=summarizeStructures({...base,structure,root:0})
    assert.equal(rows[0].pitchClassSets,1)
    assert.deepEqual(rows[0].examples,[intervals])
  }
})

test('four voices double triads, but seventh chords have four distinct classes; incompatible constraints are empty', () => {
  for(const [structure,{intervals}] of Object.entries(chordTypes)) {
    const constraints={...base,structure}
    const sample=sampleChords(constraints,20,null,seeded())
    assert.equal(sample.length,20)
    assert.ok(sample.every(chord=>chord.length===4 && pcs(chord).length===intervals.length))
    for(const incompatible of [{distinct:intervals.length===3?4:3},{voices:intervals.length-1},{inversion:intervals.length}]) {
      assert.equal(enumerateChords({...constraints,...incompatible}).count,0)
      assert.deepEqual(feasiblePitchClassSets({...constraints,...incompatible}),[])
    }
    if(structure!=='augmented') {
      assert.ok(enumerateChords({...constraints,root:0,pitchClasses:[intervals[1]]}).count>0)
      const absent=Array.from({length:12},(_,pc)=>pc).find(pc=>!intervals.includes(pc))
      assert.equal(enumerateChords({...constraints,root:0,pitchClasses:[absent]}).count,0)
    }
  }
})

test('augmented triads retain symmetric ambiguity with Root Any and no arbitrary fixed root', () => {
  const intervals=selectedIntervals('augmented')
  assert.equal(structuralRoot([0,4,8],intervals),null)
  assert.equal(enumerateChords({...base,voices:8,low:0,high:127,structure:'augmented',root:0}).count,0)
  for(const inversion of [0,1,2]) {
    assert.ok(enumerateChords({...base,structure:'augmented',inversion}).count>0)
    assert.ok(sampleChords({...base,structure:'augmented',inversion},20,null,seeded()).every(chord=>voicingInversions(chord,intervals).includes(inversion)))
  }
  for(let root=0;root<12;root++) {
    const constraints={...base,structure:'augmented',root}
    assert.equal(enumerateChords(constraints).count,0)
    assert.deepEqual(sampleChords(constraints,20),[])
    assert.deepEqual(summarizeStructures(constraints),[])
  }
})

test('bounded counting, mathematical row inspection and autoplay use selected type interpretation', () => {
  assert.equal(enumerateChords({...base,low:0,high:127,voices:6,structure:'major7',root:0}).count,10001)
  const constraints={...base,structure:'dominant7',root:2,inversion:3}
  const key=normalizePitchClasses(selectedIntervals('dominant7')).join('–')
  const inspection=sampleChords(constraints,20,key,seeded())
  assert.equal(inspection.length,20)
  assert.ok(inspection.every(chord=>chord[0]%12===0)) // D dominant seventh, C in bass.
  let current=constraints,tick
  const played=[]
  const autoplay=createAutoplay(()=>sampleChords(current,1,null,seeded()),chord=>played.push(chord),()=>{},callback=>{tick=callback;return 1},()=>{})
  autoplay.start();tick()
  current={...base,structure:'sus4',root:0,inversion:1};tick()
  assert.equal(played[0][0]%12,0)
  assert.equal(played[1][0]%12,5)
  autoplay.stop()
})
