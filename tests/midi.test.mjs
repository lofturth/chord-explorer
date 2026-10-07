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
