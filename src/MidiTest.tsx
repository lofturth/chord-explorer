import { TEST_NOTES } from './midi'
import type { useMidi } from './useMidi'

export function MidiTest({ midi }: { midi: ReturnType<typeof useMidi> }) {
  const { access, outputs, selected, setSelected, requesting, status, supported, requestAccess, play } = midi
  return <section className="midi-test" aria-label="Temporary MIDI output test">
    <h2>MIDI output test</h2>
    {!supported ? <p>Web MIDI is unavailable in this browser. Open this page in a Web-MIDI-capable browser such as Chrome.</p> : <>
      <button type="button" onClick={requestAccess} disabled={requesting || !!access}>{requesting ? 'Requesting…' : 'Request MIDI access'}</button>
      {access && <>
        <label>MIDI output <select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose an output</option>{outputs.map(port => <option key={port.id} value={port.id}>{port.name || port.id}</option>)}</select></label>
        <button type="button" onClick={() => play(TEST_NOTES)} disabled={!selected}>Send C4–E4–G4</button>
        {outputs.length === 0 && <p>No MIDI outputs found. Enable a macOS IAC bus or connect a MIDI destination, then try again.</p>}
      </>}
      <p role="status">{status}</p>
    </>}
  </section>
}
