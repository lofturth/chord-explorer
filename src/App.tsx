import { useMemo, useState } from 'react'
import { DISPLAY_LIMIT, enumerateChords, names, noteName } from './chords'
import './App.css'
const pitches = Array.from({ length: 128 }, (_, midi) => midi)
function App() {
  const [voices, setVoices] = useState(4)
  const [low, setLow] = useState(48)
  const [high, setHigh] = useState(84)
  const [distinct, setDistinct] = useState(0)
  const [pitchClasses, setPitchClasses] = useState<number[]>([])
  const effectiveDistinct = pitchClasses.length || distinct || null
  const result = useMemo(() => enumerateChords({ voices, low, high, distinct: effectiveDistinct, pitchClasses }), [voices, low, high, effectiveDistinct, pitchClasses])
  return (
    <main>
      <h1>Chord-space explorer</h1>
      <p>Change constraints to narrow the space of possible chords.</p>
      <table className="constraints">
        <caption>Constraints</caption>
        <tbody>
          <tr><th scope="row"><label htmlFor="voices">Number of voices</label></th><td>
            <select id="voices" value={voices} onChange={e => setVoices(Number(e.target.value))}>
              {Array.from({ length: 8 }, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
            </select>
          </td></tr>
          <tr><th scope="row">Pitch classes</th><td>
            <div className="pitch-classes" role="group" aria-label="Pitch classes">
              {names.map((name, pc) => <label key={pc}><input type="checkbox" checked={pitchClasses.includes(pc)} onChange={e => setPitchClasses(current => e.target.checked ? [...current, pc] : current.filter(value => value !== pc))} />{name}</label>)}
            </div>
            <small>Select the exact set of pitch classes. None selected means any set.</small>
          </td></tr>
          <tr><th scope="row">Pitch range</th><td className="range">
            <label>Lowest pitch <select value={low} onChange={e => setLow(Number(e.target.value))}>{pitches.map(n => <option key={n} value={n}>{noteName(n)}</option>)}</select></label>
            <span>to</span>
            <label>Highest pitch <select value={high} onChange={e => setHigh(Number(e.target.value))}>{pitches.map(n => <option key={n} value={n}>{noteName(n)}</option>)}</select></label>
          </td></tr>
          <tr><th scope="row"><label htmlFor="distinct">Number of distinct pitch classes</label></th><td>
            <select id="distinct" value={pitchClasses.length || distinct} disabled={pitchClasses.length > 0} aria-describedby={pitchClasses.length ? 'derived-distinct' : undefined} onChange={e => setDistinct(Number(e.target.value))}>
              <option value={0}>Any</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
            </select>
            {pitchClasses.length > 0 && <p id="derived-distinct"><small>Determined by the selected pitch classes.</small></p>}
          </td></tr>
        </tbody>
      </table>
      <p className="definition">Each chord uses different pitches, ordered low to high. Octave doubling is allowed; repeating the same pitch is excluded. Range endpoints are included. Tuning: fixed 12-tone equal temperament.</p>
      <section aria-label="Results">
        <h2 className="count" aria-live="polite">Remaining possibilities: {result.capped ? '>10,000' : result.count.toLocaleString('en-US')}</h2>
        {low > high ? <p role="alert">Choose a lowest pitch at or below the highest pitch.</p>
          : result.count === 0 ? <p>No chords match these constraints.</p>
          : result.capped ? <p>Counting stopped at the 10,001st match. Narrow the constraints to see an exact count.</p>
          : result.count > DISPLAY_LIMIT ? <p>Exact count shown. Narrow to 1,000 or fewer possibilities to see every chord.</p>
          : <><p>All {result.count} matching chords:</p><ul className="chords">{result.chords.map(chord => <li key={chord.join(',')}>{chord.map(noteName).join(' – ')}</li>)}</ul></>}
      </section>
      <footer>{__DEPLOY_ENV__} · {__GIT_COMMIT__} · v{__APP_VERSION__}</footer>
    </main>
  )
}
export default App
