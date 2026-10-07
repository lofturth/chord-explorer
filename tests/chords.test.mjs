import test from 'node:test'
import assert from 'node:assert/strict'
import { enumerateChords, noteName } from '../src/chords.ts'
const count = (changes = {}) => enumerateChords({ voices: 3, low: 48, high: 60, distinct: null, ...changes })
test('each constraint changes the count', () => {
  assert.equal(count().count, 286)
  assert.equal(count({ voices: 2 }).count, 78)
  assert.equal(count({ high: 59 }).count, 220)
  assert.equal(count({ distinct: 3 }).count, 275)
  assert.equal(count({ distinct: 2 }).count, 11)
})
test('octave doubling is one pitch class; exact unisons are excluded', () => {
  assert.deepEqual(count({ voices: 2, distinct: 1 }).chords, [[48, 60]])
  assert.equal(count({ voices: 2, low: 48, high: 48 }).count, 0)
  assert.equal(count({ distinct: 4 }).count, 0)
  assert.equal(count({ low: 61, high: 60 }).count, 0)
})
test('large enumeration stops at the 10,001st match', () => {
  const large = count({ voices: 7, low: 48, high: 63 })
  assert.equal(large.count, 10001)
  assert.equal(large.capped, true)
  assert.deepEqual(large.chords, [])
  const exact = count({ voices: 7, low: 48, high: 62 })
  assert.equal(exact.count, 6435)
  assert.equal(exact.capped, false)
})
test('small result contains every unique ascending chord with inclusive endpoints', () => {
  const result = count({ voices: 2, high: 50 })
  assert.deepEqual(result.chords, [[48, 49], [48, 50], [49, 50]])
  assert.equal(result.count, 3)
  assert.equal(result.chords[1].map(noteName).join(' – '), 'C3 – D3')
})
test('pruned distinct-class counts agree with an independent exhaustive reference', () => {
  for (let voices = 1; voices <= 4; voices++) {
    const reference = []
    function generate(notes, start) {
      if (notes.length === voices) { reference.push(notes); return }
      for (let n = start; n <= 62; n++) generate([...notes, n], n + 1)
    }
    generate([], 48)
    for (let distinct = 1; distinct <= voices; distinct++) {
      const expected = reference.filter(notes => new Set(notes.map(n => n % 12)).size === distinct)
      const result = count({ voices, high: 62, distinct })
      assert.equal(result.count, expected.length)
      if (expected.length <= 1000) assert.deepEqual(result.chords, expected)
    }
  }
})
test('selected pitch classes require exactly the selected set, with octave doubling', () => {
  const result = count({ pitchClasses: [0, 4, 7] })
  assert.deepEqual(result.chords, [[48, 52, 55], [52, 55, 60]])
  assert.equal(count({ pitchClasses: [0, 4, 7], distinct: 2 }).count, 0)
  assert.equal(count({ pitchClasses: [0, 4, 7], voices: 2 }).count, 0)
  assert.equal(count({ pitchClasses: [0, 4, 7], high: 54 }).count, 0)
  assert.deepEqual(count({ pitchClasses: [0, 4, 7], voices: 4 }).chords, [[48, 52, 55, 60]])
  assert.deepEqual(count({ pitchClasses: [0, 4, 7], distinct: 3 }), result)
  assert.deepEqual(count({ pitchClasses: [] }), count())
})
test('display threshold includes 1,000 and excludes larger sets without capping the count', () => {
  // Ten pitches from each selected class: 10 × 10 × 10 voicings.
  const exact = count({ low: 0, high: 119, pitchClasses: [0, 4, 7] })
  assert.equal(exact.count, 1000)
  assert.equal(exact.chords.length, 1000)
  const larger = count({ low: 0, high: 120, pitchClasses: [0, 4, 7] })
  assert.equal(larger.count, 1100)
  assert.equal(larger.capped, false)
  assert.deepEqual(larger.chords, [])
})
