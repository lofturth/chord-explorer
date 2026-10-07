import test from 'node:test'
import assert from 'node:assert/strict'
import { sendTestChord } from '../src/midi.ts'
test('fixed C4 E4 G4 note-ons and note-offs are queued on channel 1 for 1.5 seconds', () => {
  const calls=[]
  sendTestChord({send:(data,timestamp)=>calls.push({data,timestamp})},200)
  assert.deepEqual(calls,[
    {data:[0x90,60,80],timestamp:200},{data:[0x80,60,0],timestamp:1700},
    {data:[0x90,64,80],timestamp:200},{data:[0x80,64,0],timestamp:1700},
    {data:[0x90,67,80],timestamp:200},{data:[0x80,67,0],timestamp:1700},
  ])
})
test('partial queue failure attempts note releases and reports the failure', () => {
  const calls=[]
  let attempt=0
  assert.throws(()=>sendTestChord({send:(data,timestamp)=>{
    calls.push({data,timestamp})
    if(++attempt===2) throw new Error('Port disconnected')
  }},200), /Port disconnected/)
  assert.deepEqual(calls.slice(2).map(call=>call.data),[[0x80,60,0],[0x80,64,0],[0x80,67,0]])
})


function harness(random = () => 0.5, supportsClear = false) {
  const sent=[], timers=[], cancelled=[]
  const output={send:data=>sent.push(data)}
  if(supportsClear) output.clear=()=>sent.push('clear')
  return {sent,timers,cancelled,output,random}
}

test('Gaussian velocities round around 38 and clamp both tails to MIDI bounds', async () => {
  const { sampleVelocity } = await import('../src/midi.ts')
  const sample = (radius, angle) => {
    const draws = [1 - Math.exp(-radius * radius / 2), angle]
    return sampleVelocity(() => draws.shift())
  }
  assert.equal(sample(0, 0), 38)
  assert.equal(sample(1, 0), 53)
  assert.equal(sample(1, 0.5), 23)
  assert.equal(sample(2, 0), 68)
  assert.equal(sample(2, 0.5), 8)
  assert.equal(sample(0.1, 0), 40)
  assert.equal(sample(7, 0), 127)
  assert.equal(sample(7, 0.5), 1)
  for (const radius of [0, 0.1, 1, 2, 3, 7]) {
    for (const angle of [0, 0.25, 0.5, 0.75, 0.99]) {
      const velocity = sample(radius, angle)
      assert.ok(Number.isInteger(velocity) && velocity >= 1 && velocity <= 127)
    }
  }
})

test('performance keeps exact pitches and independently draws valid timing and velocity', async () => {
  const { randomPerformance, concreteMidiNotes } = await import('../src/midi.ts')
  const { noteName } = await import('../src/chords.ts')
  const draws=[1-Math.exp(-0.5),0.5, 0,0, 1-Math.exp(-0.5),0, 1-Math.exp(-8),0, 0,0, 1-Math.exp(-0.5),0, 1-Math.exp(-0.5),0.5, 0,0]
  const chord=[48,55,64,83]
  const events=randomPerformance(chord,()=>draws.shift())
  assert.deepEqual(events.map(event=>event.note),chord)
  assert.deepEqual(chord,[48,55,64,83])
  assert.deepEqual(events.map(event=>event.velocity),[38,53,23,38])
  const expected=[0,25,50,125]
  events.forEach((event,index)=>assert.ok(Math.abs(event.onsetMs-expected[index])<1e-8))
  assert.equal(Math.min(...events.map(event=>event.onsetMs)),0)
  for(const event of events) {
    assert.ok(event.onsetMs>=0)
    assert.ok(Number.isInteger(event.velocity) && event.velocity>=1 && event.velocity<=127)
  }
  assert.equal([48,52,67].map(noteName).join(' – '),'C3 – E3 – G4')
  assert.throws(()=>concreteMidiNotes([128]), /Invalid/)
})

test('signed Gaussian timing has zero center and permits unclamped rare large offsets', async () => {
  const { sampleTimingOffset, normalizeOnsets } = await import('../src/midi.ts')
  const sample = (radius, angle) => {
    const draws=[1-Math.exp(-radius*radius/2),angle]
    return sampleTimingOffset(()=>draws.shift())
  }
  assert.equal(sample(0,0),0)
  for (const [radius,angle,expected] of [[1,0,25],[1,0.5,-25],[5,0,125],[5,0.5,-125]]) {
    assert.ok(Math.abs(sample(radius,angle)-expected)<1e-6)
  }
  const offsets=[-70,15,90]
  const onsets=normalizeOnsets(offsets)
  assert.deepEqual(onsets,[0,85,160])
  assert.deepEqual(offsets,[-70,15,90])
  for(let i=0;i<offsets.length;i++) for(let j=0;j<offsets.length;j++) {
    assert.equal(onsets[i]-onsets[j],offsets[i]-offsets[j])
  }
  assert.deepEqual(normalizeOnsets([70,15,90]),[55,0,75])
  assert.deepEqual(normalizeOnsets([50]),[0])
  assert.deepEqual(normalizeOnsets([]),[])
})

test('playback preserves octaves and releases every note 1.5 seconds after attack', async () => {
  const { createChordPlayer } = await import('../src/midi.ts')
  for(const chord of [[48,52,67],[60,64,79],[52,55,60],[36,64,91]]) {
    const h=harness()
    const player=createChordPlayer((callback,delay)=>{h.timers.push({callback,delay});return h.timers.length},id=>h.cancelled.push(id),h.random)
    player.play(h.output,chord)
    const attacks=[...h.timers]
    attacks.forEach(timer=>timer.callback())
    assert.deepEqual(h.sent.map(data=>data[1]),chord)
    const releases=h.timers.slice(attacks.length)
    assert.ok(releases.every(timer=>timer.delay===1500))
    releases.forEach(timer=>timer.callback())
    assert.deepEqual(h.sent.filter(data=>data[0]===0x80).map(data=>data[1]),chord)
  }
})

test('rapid retriggering cancels pending attacks and stale callbacks for both port types', async () => {
  const { createChordPlayer } = await import('../src/midi.ts')
  for(const supportsClear of [false,true]) {
    const h=harness(()=>0.5,supportsClear)
    const player=createChordPlayer((callback,delay)=>{h.timers.push({callback,delay});return h.timers.length},id=>h.cancelled.push(id),h.random)
    player.play(h.output,[48,52,67])
    const stale=[...h.timers]
    stale[0].callback()
    const staleRelease=h.timers[3]
    player.play(h.output,[60,64,79])
    assert.ok(h.cancelled.includes(1) && h.cancelled.includes(4))
    assert.ok(h.sent.some(data=>Array.isArray(data) && data[0]===0x80 && data[1]===48))
    const before=h.sent.length
    stale.forEach(timer=>timer.callback())
    staleRelease.callback()
    assert.equal(h.sent.length,before)
    h.timers.slice(4,7).forEach(timer=>timer.callback())
    assert.deepEqual(h.sent.filter(data=>Array.isArray(data) && data[0]===0x90).map(data=>data[1]),[48,60,64,79])
    player.stop()
  }
})
