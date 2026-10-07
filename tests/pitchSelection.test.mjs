import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcilePitchSelection, pitchClassDisabled } from '../src/pitchSelection.ts'
import { enumerateChords } from '../src/chords.ts'
import { feasiblePitchClassSets, summarizeStructures, normalizePitchClasses } from '../src/summary.ts'
import { sampleChords } from '../src/sampling.ts'
import { createAutoplay } from '../src/autoplay.ts'

const base = { voices: 4, low: 48, high: 64, distinct: null, structure: 'any' }
const pcs = chord => [...new Set(chord.map(note => note % 12))]
const contains = (chord, required) => required.every(pc => pcs(chord).includes(pc))

test('required selection agrees with independent exhaustive counts and bounded examples', () => {
  const all = []
  function visit(notes, start) {
    if (notes.length === 4) { all.push(notes); return }
    for (let note = start; note <= base.high; note++) visit([...notes,note], note+1)
  }
  visit([], base.low)
  for (const required of [[], [0], [0,4], [0,4,7], [0,4,7,11]]) {
    for (const distinct of [null, 2, 3, 4]) {
      const expected = all.filter(chord => contains(chord,required) && (distinct === null || pcs(chord).length === distinct))
      const result = enumerateChords({...base,pitchClasses:required,distinct})
      assert.equal(result.count, expected.length)
      assert.deepEqual(result.chords, expected.slice(0,100))
    }
  }
  assert.deepEqual(enumerateChords({...base,pitchClasses:[]}), enumerateChords(base))
  const candidates = sampleChords({...base,pitchClasses:[0,4]},100)
  assert.ok(candidates.every(chord=>contains(chord,[0,4])))
  assert.ok(candidates.some(chord=>pcs(chord).length > 2))
  assert.ok(candidates.some(chord=>pcs(chord).length < chord.length))
  assert.equal(enumerateChords({...base,voices:1,pitchClasses:[0,4]}).count,0)
})

test('UI selection limits keep selected controls enabled and reconcile voice/distinct changes', () => {
  const required = [7,0,4,11]
  assert.equal(pitchClassDisabled(2,required,4),true)
  for (const pc of required) assert.equal(pitchClassDisabled(pc,required,4),false)
  assert.equal(pitchClassDisabled(2,required.slice(0,3),4),false)
  assert.deepEqual(reconcilePitchSelection(2,required,4),{pitchClasses:[7,0],distinct:2})
  assert.deepEqual(reconcilePitchSelection(4,[0,4,7],2),{pitchClasses:[0,4,7],distinct:3})
  assert.deepEqual(reconcilePitchSelection(4,[0,4],0),{pitchClasses:[0,4],distinct:0})
  assert.deepEqual(reconcilePitchSelection(4,[0],3),{pitchClasses:[0],distinct:3})
})

test('summary and structure-inspection examples include requirements and permitted additions', () => {
  const constraints = {...base, pitchClasses:[0,4],distinct:3}
  const sets = feasiblePitchClassSets(constraints)
  assert.equal(sets.length,10)
  assert.ok(sets.every(set=>set.length===3 && [0,4].every(pc=>set.includes(pc))))
  const rows = summarizeStructures(constraints)
  assert.equal(rows.reduce((sum,row)=>sum+row.pitchClassSets,0),sets.length)
  for (const row of rows) {
    assert.ok(row.examples.every(set=>[0,4].every(pc=>set.includes(pc))))
    const chords = sampleChords(constraints,20,row.intervals.join('–'))
    assert.ok(chords.length>0)
    assert.ok(chords.every(chord=>contains(chord,[0,4]) && pcs(chord).length===3 && normalizePitchClasses(pcs(chord)).join('–')===row.intervals.join('–')))
  }
})

test('autoplay samples use required membership rather than an exact set', () => {
  let tick
  const played=[]
  let constraints={...base,pitchClasses:[0,4],distinct:3}
  const autoplay=createAutoplay(()=>sampleChords(constraints,1), chord=>played.push(chord),()=>{},callback=>{tick=callback;return 1},()=>{})
  autoplay.start()
  tick()
  assert.ok(contains(played[0],[0,4]))
  assert.equal(pcs(played[0]).length,3)
  constraints={...base,pitchClasses:[2,5],distinct:4}
  tick()
  assert.ok(contains(played[1],[2,5]))
  assert.equal(pcs(played[1]).length,4)
  autoplay.stop()
})
