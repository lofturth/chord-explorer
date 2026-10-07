import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePitchClasses, summarizeStructures } from '../src/summary.ts'
import { enumerateChords } from '../src/chords.ts'
const base = { voices: 3, low: 48, high: 71, distinct: null }
const total = rows => rows.reduce((sum, row) => sum + row.pitchClassSets, 0)
test('all transposed major and minor sets preserve their recognized representations', () => {
  for (const [structure, intervals, type] of [['major', [0,4,7], 'Major triad'], ['minor', [0,3,7], 'Minor triad']]) {
    for (let root = 0; root < 12; root++) assert.deepEqual(normalizePitchClasses(intervals.map(i => (root + i) % 12)), intervals)
    const rows = summarizeStructures({ ...base, structure })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].pitchClassSets, 12)
    assert.equal(rows[0].type, type)
  }
  assert.notDeepEqual(normalizePitchClasses([0,4,7]), normalizePitchClasses([0,3,7]))
})
test('normalization is deterministic for ambiguous references and symmetric sets', () => {
  assert.deepEqual(normalizePitchClasses([8,0,4]), [0,4,8])
  const expected = normalizePitchClasses([0,1,6,7])
  for (let shift = 0; shift < 12; shift++) assert.deepEqual(normalizePitchClasses([7,6,1,0].map(pc => (pc + shift) % 12)), expected)
})
test('octave placement and doubling collapse to one pitch-class set', () => {
  const constraints = { ...base, voices: 4, distinct: 3, pitchClasses: [0,4,7] }
  assert.ok(enumerateChords(constraints).count > 1)
  const rows = summarizeStructures(constraints)
  assert.equal(total(rows), 1)
  assert.deepEqual(rows[0].examples, [[0,4,7]])
})
test('range, voices, required selection, distinct count and structure affect feasibility', () => {
  assert.equal(total(summarizeStructures({ ...base, distinct: 3 })), 220)
  assert.equal(total(summarizeStructures({ ...base, high: 50, distinct: 3 })), 1)
  assert.equal(total(summarizeStructures({ ...base, high: 50, voices: 4 })), 0)
  assert.equal(total(summarizeStructures({ ...base, voices: 2, structure: 'major' })), 0)
  assert.equal(total(summarizeStructures({ ...base, structure: 'minor', pitchClasses: [0,4,7] })), 0)
  assert.equal(total(summarizeStructures({ ...base, distinct: 2, pitchClasses: [0,4,7] })), 0)
  assert.equal(total(summarizeStructures({ ...base, voices: 4, high: 59, distinct: 3, pitchClasses: [0,4,7] })), 0)
})
test('summary examples satisfy constraints and the reported structure', () => {
  for (const constraints of [base, { ...base, voices: 4, high: 62 }, { ...base, structure: 'minor' }, { ...base, pitchClasses: [0,4,7] }]) {
    for (const row of summarizeStructures(constraints)) {
      for (const pitchClasses of row.examples) {
        assert.ok(enumerateChords({ ...constraints, pitchClasses }).count > 0)
        assert.deepEqual(normalizePitchClasses(pitchClasses), row.intervals)
      }
    }
  }
})
test('summary covers sets absent from the capped concrete preview', () => {
  const constraints = { ...base, voices: 4, low: 0, high: 127 }
  const preview = enumerateChords(constraints)
  assert.equal(preview.capped, true)
  assert.equal(preview.chords.length, 100)
  // All subsets of 1–4 classes: C(12,1)+C(12,2)+C(12,3)+C(12,4).
  assert.equal(total(summarizeStructures(constraints)), 793)
  const previewSets = new Set(preview.chords.map(notes => [...new Set(notes.map(n => n % 12))].sort((a,b) => a-b).join()))
  assert.ok(previewSets.size < 793)
})
test('summary matches exhaustive concrete sets in a small space', () => {
  const constraints = { ...base, voices: 3, high: 62 }
  const concreteSets = new Set(enumerateChords(constraints).chords.map(notes => [...new Set(notes.map(n => n % 12))].sort((a,b) => a-b).join()))
  // Count is 455, so obtain exhaustive voicings using fixed pitch-class subsets.
  const reference = new Map()
  for (let mask = 1; mask < 4096; mask++) {
    const pcs = Array.from({length:12},(_,pc)=>pc).filter(pc=>mask & (1 << pc))
    if (!enumerateChords({...constraints,pitchClasses:pcs,distinct:pcs.length}).count) continue
    const key = normalizePitchClasses(pcs).join()
    reference.set(key, (reference.get(key) ?? 0) + 1)
  }
  assert.ok(concreteSets.size > 0)
  assert.deepEqual(new Map(summarizeStructures(constraints).map(row=>[row.intervals.join(),row.pitchClassSets])), reference)
})
