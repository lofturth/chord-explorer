import { useEffect, useRef, useState } from 'react'
import { sendTestChord, TEST_DURATION } from './midi'

export function MidiTest() {
  const [access, setAccess] = useState<MIDIAccess | null>(null)
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [selected, setSelected] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('Request access to list MIDI outputs.')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supported = typeof navigator.requestMIDIAccess === 'function'
  useEffect(() => {
    if (!access) return
    function refresh() {
      const ports = [...access!.outputs.values()].filter(port => port.state === 'connected')
      setOutputs(ports)
      setSelected(current => ports.some(port => port.id === current) ? current : '')
    }
    refresh()
    access.addEventListener('statechange', refresh)
    return () => access.removeEventListener('statechange', refresh)
  }, [access])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  async function requestAccess() {
    setRequesting(true)
    try {
      const midi = await navigator.requestMIDIAccess({ sysex: false })
      setAccess(midi)
      setStatus('MIDI access granted. Select an output to test.')
    } catch (error) {
      setStatus(`MIDI access failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally { setRequesting(false) }
  }
  async function send() {
    const output = outputs.find(port => port.id === selected)
    if (!output) { setStatus('Select a connected MIDI output.'); return }
    setPlaying(true)
    try {
      await output.open()
      sendTestChord(output)
      setStatus(`Sent C4–E4–G4 to ${output.name || 'selected output'}; note-offs scheduled after 1.5 seconds.`)
      timer.current = setTimeout(() => setPlaying(false), TEST_DURATION)
    } catch (error) {
      setStatus(`MIDI send failed: ${error instanceof Error ? error.message : String(error)}`)
      setPlaying(false)
    }
  }
  return <section className="midi-test" aria-label="Temporary MIDI output test">
    <h2>MIDI output test</h2>
    {!supported ? <p>Web MIDI is unavailable in this browser. Open this page in a Web-MIDI-capable browser such as Chrome.</p> : <>
      <button type="button" onClick={requestAccess} disabled={requesting || !!access}>{requesting ? 'Requesting…' : 'Request MIDI access'}</button>
      {access && <>
        <label>MIDI output <select value={selected} disabled={playing} onChange={e => setSelected(e.target.value)}><option value="">Choose an output</option>{outputs.map(port => <option key={port.id} value={port.id}>{port.name || port.id}</option>)}</select></label>
        <button type="button" onClick={send} disabled={!selected || playing}>Send C4–E4–G4</button>
        {outputs.length === 0 && <p>No MIDI outputs found. Enable a macOS IAC bus or connect a MIDI destination, then try again.</p>}
      </>}
      <p role="status">{status}</p>
    </>}
  </section>
}
