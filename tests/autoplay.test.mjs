import test from 'node:test'
import assert from 'node:assert/strict'
import { AUTOPLAY_INTERVALS, DEFAULT_AUTOPLAY_INTERVAL, chooseAutoplayChord, createAutoplay } from '../src/autoplay.ts'
import { sampleChords } from '../src/sampling.ts'

test('autoplay chooses only valid global candidates, independently of preview order', () => {
  const constraints = { voices: 3, low: 48, high: 72, distinct: 3, pitchClasses: [0, 4, 7], structure: 'major' }
  const candidates = sampleChords(constraints, 100)
  for (const draw of [0, 0.2, 0.8, 0.999999]) {
    const chord = chooseAutoplayChord(candidates, () => draw)
    assert.ok(candidates.includes(chord))
    assert.equal(chord.length, 3)
    assert.ok(chord.every(note => note >= 48 && note <= 72))
    assert.deepEqual([...new Set(chord.map(note => note % 12))].sort((a,b) => a-b), [0,4,7])
  }
  assert.equal(chooseAutoplayChord(candidates, () => 0.999999), candidates.at(-1))
  assert.equal(chooseAutoplayChord([], () => 0), null)
})

test('autoplay reads latest candidates, waits through empty spaces and resumes', () => {
  let candidates = [[48,52,55]]
  const played = []
  let tick
  const autoplay = createAutoplay(() => candidates, chord => played.push(chord), () => {}, callback => { tick = callback; return 1 }, () => {}, () => 0)
  autoplay.start()
  tick()
  candidates = [[60,63,67]]
  tick()
  candidates = []
  tick()
  assert.deepEqual(played, [[48,52,55],[60,63,67]])
  candidates = [[72,76,79]]
  tick()
  assert.deepEqual(played.at(-1), candidates[0])
  autoplay.stop()
})

test('stop cancels timer and releases playback; repeated toggling rejects stale ticks', () => {
  const scheduled = [], cancelled = [], played = []
  let releases = 0
  const autoplay = createAutoplay(() => [[60]], chord => played.push(chord), () => releases++, (callback, delay) => {
    assert.equal(delay, 1000)
    scheduled.push(callback)
    return scheduled.length
  }, timer => cancelled.push(timer))
  autoplay.start()
  autoplay.start()
  assert.equal(scheduled.length, 1)
  scheduled[0]()
  autoplay.stop()
  scheduled[0]()
  assert.equal(played.length, 1)
  assert.equal(releases, 1)
  assert.deepEqual(cancelled, [1])
  autoplay.start()
  scheduled[0]()
  scheduled[1]()
  assert.equal(played.length, 2)
  autoplay.stop()
  assert.deepEqual(cancelled, [1,2])
})

test('interval choices replace the running timer and invalidate old callbacks', () => {
  assert.equal(DEFAULT_AUTOPLAY_INTERVAL, 1000)
  assert.deepEqual(AUTOPLAY_INTERVALS, [250, 500, 1000, 2000])
  const active = new Map(), callbacks = [], delays = [], played = []
  let releases = 0
  const autoplay = createAutoplay(() => [[60]], chord => played.push(chord), () => releases++, (callback, delay) => {
    const id = callbacks.push(callback)
    delays.push(delay)
    active.set(id, callback)
    return id
  }, id => active.delete(id))
  autoplay.start()
  assert.deepEqual(delays, [1000])
  for (const interval of AUTOPLAY_INTERVALS) {
    const previous = callbacks.at(-1)
    autoplay.start(interval)
    assert.equal(active.size, 1)
    assert.equal(delays.at(-1), interval)
    const count = played.length
    previous()
    assert.equal(played.length, count)
    callbacks.at(-1)()
    assert.equal(played.length, count + 1)
    const scheduled = callbacks.length
    autoplay.start(interval)
    assert.equal(callbacks.length, scheduled)
  }
  assert.equal(releases, 0)
  autoplay.stop()
  assert.equal(active.size, 0)
  assert.equal(releases, 1)
  const count = played.length
  callbacks.forEach(callback => callback())
  assert.equal(played.length, count)
})
