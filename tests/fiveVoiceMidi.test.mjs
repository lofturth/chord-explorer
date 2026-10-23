import test from 'node:test'
import assert from 'node:assert/strict'
import { createFiveVoicePlayer } from '../src/fiveVoiceMidi.ts'

const withoutPedal = messages => messages.filter(data => (data[0] & 0xF0) !== 0xB0)

const chord = [60, 64, 67, 71, 74]
const columns = (touched, value = 0.75) => chord.map(() => ({ touched, value }))
const pedal = value => chord.map((_, i) => [0xB1 + i, 64, value])

test('maximum velocity scales new attacks only, leaving held notes, sustain, and pressure unchanged', () => {
  const sent = []
  const player = createFiveVoicePlayer()
  player.configure({ send: data => sent.push(data) }, chord, true)
  player.update(columns(true))
  sent.length = 0
  player.setMaxVelocity(65)
  assert.deepEqual(sent, [])
  player.update(columns(true, 0.5))
  assert.deepEqual(sent, chord.map((_, i) => [0xD1 + i, 64]))
  player.update(columns(false))
  sent.length = 0
  player.update([0, 0.25, 0.5, 0.75, 1].map(value => ({ touched: true, value })))
  assert.deepEqual(sent, [...pedal(0), ...pedal(127), ...chord.flatMap((note, i) =>
    [[0xD1 + i, [0, 32, 64, 95, 127][i]], [0x91 + i, note, [1, 17, 33, 49, 65][i]]])])
  player.update(columns(false))
  player.setMaxVelocity(1)
  sent.length = 0
  player.update(columns(true, 1))
  assert.deepEqual(sent, [...pedal(0), ...pedal(127), ...chord.flatMap((note, i) =>
    [[0xD1 + i, 127], [0x91 + i, note, 1]])])
})

test('sustain pulses once before new attacks, releases lifts first, and preserves held fingers', () => {
  const sent = []
  const player = createFiveVoicePlayer()
  player.configure({ send: data => sent.push(data) }, chord, true)
  assert.deepEqual(sent, pedal(127))
  sent.length = 0
  player.update(columns(true))
  assert.deepEqual(sent, [...pedal(0), ...pedal(127),
    ...chord.flatMap((note, i) => [[0xD1 + i, 95], [0x91 + i, note, 96]])])
  sent.length = 0
  player.update(chord.map((_, i) => ({ touched: i !== 0, value: 0.75 })))
  assert.deepEqual(sent, [[0x81, 60, 0], ...[1, 2, 3, 4].map(i => [0xD1 + i, 95])])
  sent.length = 0
  // Finger 1 starts again while finger 2 lifts and fingers 3–5 stay held.
  player.update(chord.map((_, i) => ({ touched: i !== 1, value: 0.5 })))
  assert.deepEqual(sent, [[0x82, 64, 0], ...pedal(0), ...pedal(127),
    [0xD1, 64], [0x91, 60, 64], [0xD3, 64], [0xD4, 64], [0xD5, 64]])
})

test('disable, disconnect, and output changes release pedal and notes on the old destination', () => {
  for (const operation of ['disable', 'disconnect', 'output']) {
    const sent = [], nextSent = []
    const output = { send: data => sent.push(data) }
    const player = createFiveVoicePlayer()
    player.configure(output, chord, true)
    player.update(columns(true))
    sent.length = 0
    if (operation === 'disable') player.configure(output, null, false)
    if (operation === 'disconnect') player.disconnect()
    if (operation === 'output') player.configure({send: data => nextSent.push(data)}, chord, true)
    assert.deepEqual(sent, [...pedal(0), ...chord.map((note, i) => [0x81 + i, note, 0])])
    assert.deepEqual(nextSent, operation === 'output' ? pedal(127) : [])
  }
})

test('sustain is enabled without a selected chord and cleared after every finger has lifted', () => {
  const sent = []
  const output = { send: data => sent.push(data) }
  const player = createFiveVoicePlayer()
  player.configure(output, null, true)
  assert.deepEqual(sent, pedal(127))
  player.configure(output, chord, true)
  player.update(columns(true))
  player.update(columns(false))
  sent.length = 0
  player.disconnect()
  assert.deepEqual(sent, pedal(0))
})

test('disabling playback by clearing the chord releases active notes and prevents further attacks', () => {
  const sent = []
  const output = { send: data => sent.push(data) }
  const player = createFiveVoicePlayer()
  player.configure(output, chord)
  player.update(columns(true))
  sent.length = 0
  player.configure(output, null)
  assert.deepEqual(withoutPedal(sent), chord.map((note, i) => [0x81 + i, note, 0]))
  sent.length = 0
  player.update(columns(false))
  player.update(columns(true))
  assert.deepEqual(withoutPedal(sent), [])
})

test('five voices send pressure before attacks on channels 2–6, movement only pressure, lift releases', () => {
  const sent = []
  const player = createFiveVoicePlayer()
  player.configure({ send: data => sent.push(data) }, [...chord].reverse())
  player.update(columns(true))
  assert.deepEqual(withoutPedal(sent), chord.flatMap((note, i) => [[0xD1 + i, 95], [0x91 + i, note, 96]]))
  sent.length = 0
  player.update(columns(true, 1))
  assert.deepEqual(withoutPedal(sent), chord.map((_, i) => [0xD1 + i, 127]))
  sent.length = 0
  player.update(columns(false))
  assert.deepEqual(withoutPedal(sent), chord.map((note, i) => [0x81 + i, note, 0]))
})

test('chord and output changes release old notes and require held fingers to lift', () => {
  const sent = [], nextSent = []
  const output = { send: data => sent.push(data) }
  const player = createFiveVoicePlayer()
  player.configure(output, chord)
  player.update(columns(true))
  sent.length = 0
  const nextChord = chord.map(n => n + 1)
  player.configure(output, nextChord)
  assert.deepEqual(withoutPedal(sent), chord.map((note, i) => [0x81 + i, note, 0]))
  sent.length = 0
  player.update(columns(true))
  assert.deepEqual(withoutPedal(sent), [])
  player.update(columns(false))
  player.update(columns(true, 0))
  assert.deepEqual(withoutPedal(sent), nextChord.flatMap((note, i) => [[0xD1 + i, 0], [0x91 + i, note, 1]]))
  sent.length = 0
  player.configure({send: data => nextSent.push(data)}, nextChord)
  assert.deepEqual(withoutPedal(sent), nextChord.map((note, i) => [0x81 + i, note, 0]))
  player.update(columns(true))
  assert.deepEqual(withoutPedal(nextSent), [])
})

test('disconnect releases every active voice; invalid chord sizes do not play', () => {
  const sent = []
  const output = {send: data => sent.push(data)}
  const player = createFiveVoicePlayer()
  player.configure(output, chord.slice(0, 4))
  player.update(columns(true))
  assert.deepEqual(withoutPedal(sent), [])
  player.disconnect()
  player.configure(output, chord)
  player.update(columns(true))
  sent.length = 0
  player.disconnect()
  assert.deepEqual(withoutPedal(sent), chord.map((note, i) => [0x81 + i, note, 0]))
  sent.length = 0
  player.disconnect()
  assert.deepEqual(withoutPedal(sent), [])
})

test('a send failure attempts release of all active notes', () => {
  const sent = []
  let fail = false
  const player = createFiveVoicePlayer()
  player.configure({send: data => { sent.push(data); if (fail && data[0] === 0xD3) throw Error('disconnected') }}, chord)
  player.update(columns(true))
  sent.length = 0
  fail = true
  player.update(columns(true))
  assert.deepEqual(sent.slice(-5), chord.map((note, i) => [0x81 + i, note, 0]))
})

test('each attack uses its initial position for velocity; movement only updates pressure', () => {
  const sent = []
  const player = createFiveVoicePlayer()
  player.configure({ send: data => sent.push(data) }, chord)
  const positions = [0, 0.25, 0.5, 0.75, 1]
  player.update(positions.map(value => ({ touched: true, value })))
  assert.deepEqual(sent.filter(data => data[0] >= 0x91 && data[0] <= 0x95),
    chord.map((note, i) => [0x91 + i, note, [1, 33, 64, 96, 127][i]]))
  sent.length = 0
  player.update(columns(true, 0.5))
  assert.deepEqual(withoutPedal(sent), chord.map((_, i) => [0xD1 + i, 64]))
  player.update(columns(false))
  sent.length = 0
  player.update(columns(true, 1))
  assert.deepEqual(withoutPedal(sent), chord.flatMap((note, i) => [[0xD1 + i, 127], [0x91 + i, note, 127]]))
})
