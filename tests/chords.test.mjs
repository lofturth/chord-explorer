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
  assert.equal(large.chords.length, 100)
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
      assert.deepEqual(result.chords, expected.slice(0, 100))
    }
  }
})
test('selected pitch classes are required members, with additions and octave doubling', () => {
  const result = count({ pitchClasses: [0, 4, 7] })
  assert.deepEqual(result.chords, [[48, 52, 55], [52, 55, 60]])
  assert.equal(count({ pitchClasses: [0, 4, 7], distinct: 2 }).count, 0)
  assert.equal(count({ pitchClasses: [0, 4, 7], voices: 2 }).count, 0)
  assert.equal(count({ pitchClasses: [0, 4, 7], high: 54 }).count, 0)
  assert.ok(count({ pitchClasses: [0, 4, 7], voices: 4 }).chords.some(chord => chord.join() === '48,52,55,60'))
  assert.ok(count({ pitchClasses: [0, 4, 7], voices: 4 }).chords.some(chord => new Set(chord.map(n=>n%12)).size === 4))
  assert.deepEqual(count({ pitchClasses: [0, 4, 7], distinct: 3 }), result)
  assert.deepEqual(count({ pitchClasses: [] }), count())
})
test('examples remain limited to 100 while exact counting continues', () => {
  // Ten pitches from each selected class: 10 × 10 × 10 voicings.
  const exact = count({ low: 0, high: 119, pitchClasses: [0, 4, 7] })
  assert.equal(exact.count, 1000)
  assert.equal(exact.chords.length, 100)
  const larger = count({ low: 0, high: 120, pitchClasses: [0, 4, 7] })
  assert.equal(larger.count, 1100)
  assert.equal(larger.capped, false)
  assert.equal(larger.chords.length, 100)
})

test('Major and Minor represent transposition-independent structures', async () => {
  const { structures } = await import('../src/chords.ts')
  assert.equal(structures.major, '0–4–7')
  assert.equal(structures.minor, '0–3–7')
  for (const structure of ['major', 'minor']) {
    for (let root = 0; root < 12; root++) {
      const pitchClasses = [0, structure === 'major' ? 4 : 3, 7].map(n => (root + n) % 12)
      const result = count({ low: 48, high: 71, structure, pitchClasses })
      assert.equal(result.count, 8)
      assert.ok(result.chords.every(notes => {
        const pcs = [...new Set(notes.map(n => n % 12))].sort((a, b) => a - b)
        return pcs.join() === [...pitchClasses].sort((a, b) => a - b).join()
      }))
    }
    assert.equal(count({ low: 48, high: 71, structure }).count, 96)
  }
})
test('structures combine with exact pitches, doubling, voices and distinct count', () => {
  assert.equal(count({ structure: 'major', pitchClasses: [0, 4, 7] }).count, 2)
  assert.equal(count({ structure: 'minor', pitchClasses: [0, 4, 7] }).count, 0)
  assert.equal(count({ structure: 'minor', pitchClasses: [0, 3, 7] }).count, 2)
  assert.equal(count({ structure: 'major', pitchClasses: [0, 4] }).count, 2)
  assert.equal(count({ structure: 'major', distinct: 2 }).count, 0)
  assert.equal(count({ structure: 'major', voices: 2 }).count, 0)
  assert.deepEqual(count({ structure: 'major', pitchClasses: [0, 4, 7], voices: 4 }).chords, [[48, 52, 55, 60]])
  assert.deepEqual(count({ structure: 'any' }), count())
  assert.equal(count({ structure: 'major', high: 50 }).count, 0)
})
test('structured enumeration retains the counting cutoff', () => {
  const result = count({ structure: 'major', low: 0, high: 127, voices: 4 })
  assert.equal(result.count, 10001)
  assert.equal(result.capped, true)
  assert.equal(result.chords.length, 100)
  assert.ok(result.chords.every(notes => {
    const pcs = new Set(notes.map(n => n % 12))
    return notes.length === 4 && notes.every(n => n >= 0 && n <= 127) && pcs.size === 3 &&
      [...pcs].some(root => [0, 4, 7].every(interval => pcs.has((root + interval) % 12)))
  }))
})

test('example counts handle zero, small, exactly 100 and larger sets', () => {
  assert.equal(count({ voices: 2, high: 48 }).chords.length, 0)
  assert.equal(count({ voices: 1, high: 54 }).chords.length, 7)
  const hundred = count({ voices: 3, low: 0, high: 119, pitchClasses: [0, 1], distinct: 2 })
  assert.equal(hundred.count, 900)
  assert.equal(hundred.chords.length, 100)
  const exactly = count({ voices: 2, low: 0, high: 119, pitchClasses: [0, 1] })
  assert.equal(exactly.count, 100)
  assert.equal(exactly.chords.length, 100)
})
