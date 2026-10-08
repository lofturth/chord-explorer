import { scalePitchClasses } from './scales'
import type { ScaleMode } from './scales'
import { chordTypes, selectedIntervals } from './chordTypes'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { enumerateChords, names, noteName, structures } from './chords'
import type { Structure } from './chords'
import { availableSelection, orderSummaryRows, summarizeStructures } from './summary'
import { sampleChords } from './sampling'
import './App.css'
import { MidiTest } from './MidiTest'
import { useMidi } from './useMidi'
import { AUTOPLAY_INTERVALS, DEFAULT_AUTOPLAY_INTERVAL, createAutoplay } from './autoplay'
import type { AutoplayInterval } from './autoplay'
import { inversionLabel } from './pitchStructure'
import { pitchClassDisabled, reconcilePitchSelection } from './pitchSelection'
const pitches = Array.from({ length: 128 }, (_, midi) => midi)
function App() {
  const midi = useMidi()
  const [voices, setVoices] = useState(4)
  const [low, setLow] = useState(48)
  const [high, setHigh] = useState(84)
  const [distinct, setDistinct] = useState(0)
  const [pitchClasses, setPitchClasses] = useState<number[]>([])
  const [tonic, setTonic] = useState(0)
  const [scaleMode, setScaleMode] = useState<ScaleMode>('major')
  const [restrictScale, setRestrictScale] = useState(false)
  const scaleNotes = scalePitchClasses({ tonic, mode: scaleMode })
  const activeScale = useMemo(() => restrictScale ? { tonic, mode: scaleMode } : null, [tonic, scaleMode, restrictScale])
  const [root, setRoot] = useState<number | null>(null)
  const [inversion, setInversion] = useState<number | null>(null)
  const [structure, setStructure] = useState<Structure>('any')
  const typeSize = selectedIntervals(structure)?.length ?? 0
  const derivedDistinct = structure !== 'any' ? Math.min(voices, Math.max(typeSize, pitchClasses.length)) : 0
  const effectiveDistinct = derivedDistinct || distinct || null
  const structuralSize = structure !== 'any' ? Math.min(voices, typeSize) : effectiveDistinct || voices
  const activeInversion = inversion !== null && inversion >= structuralSize ? null : inversion
  if (activeInversion !== inversion) setInversion(activeInversion)
  function updatePitchSelection(nextVoices: number, required: number[]) {
    const next = reconcilePitchSelection(nextVoices, required, distinct)
    setVoices(nextVoices)
    setPitchClasses(next.pitchClasses)
    setDistinct(next.distinct)
  }
  const result = useMemo(() => enumerateChords({ voices, low, high, distinct: effectiveDistinct, pitchClasses, structure, inversion: activeInversion, root, scale: activeScale }), [voices, low, high, effectiveDistinct, pitchClasses, structure, activeInversion, root, activeScale])
  const summary = useMemo(() => summarizeStructures({ voices, low, high, distinct: effectiveDistinct, pitchClasses, structure, inversion: activeInversion, root, scale: activeScale }), [voices, low, high, effectiveDistinct, pitchClasses, structure, activeInversion, root, activeScale])
  const [structuresOpen, setStructuresOpen] = useState(false)
  const [commonFirst, setCommonFirst] = useState(false)
  const orderedSummary = useMemo(() => orderSummaryRows(summary, commonFirst), [summary, commonFirst])
  const [selected, setSelected] = useState<string | null>(null)
  const activeSelection = availableSelection(selected, summary)
  if (selected !== activeSelection) setSelected(activeSelection)
  const constraints = useMemo(() => ({ voices, low, high, distinct: effectiveDistinct, pitchClasses, structure, inversion: activeInversion, root, scale: activeScale }), [voices, low, high, effectiveDistinct, pitchClasses, structure, activeInversion, root, activeScale])
  const examples = useMemo(() => sampleChords(constraints, 100), [constraints])
  const [autoplayEnabled, setAutoplayEnabled] = useState(false)
  const [autoplayInterval, setAutoplayInterval] = useState<AutoplayInterval>(DEFAULT_AUTOPLAY_INTERVAL)
  const autoplayLoop = useRef<ReturnType<typeof createAutoplay> | null>(null)
  const autoplayState = useRef({ constraints, play: midi.play, stop: midi.stop })
  useLayoutEffect(() => { autoplayState.current = { constraints, play: midi.play, stop: midi.stop } })
  useEffect(() => {
    if (!autoplayEnabled) return
    const autoplay = createAutoplay(
      () => sampleChords(autoplayState.current.constraints, 1),
      chord => { void autoplayState.current.play(chord) },
      () => autoplayState.current.stop(),
    )
    autoplay.start()
    autoplayLoop.current = autoplay
    return () => { autoplay.stop(); autoplayLoop.current = null }
  }, [autoplayEnabled])
  useEffect(() => { autoplayLoop.current?.start(autoplayInterval) }, [autoplayInterval, autoplayEnabled])
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (target instanceof HTMLElement && (target.closest('input, select, textarea') || target.isContentEditable)) return
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setAutoplayEnabled(current => !current)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  const inspectionSection = useRef<HTMLElement | null>(null)
  const selectedRow = useRef<HTMLTableRowElement | null>(null)
  const examplesSection = useRef<HTMLElement | null>(null)
  const [mainExamplesVisible, setMainExamplesVisible] = useState(false)
  useEffect(() => {
    const section = activeSelection ? inspectionSection.current : examplesSection.current
    if (!section) {
      setMainExamplesVisible(false)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setMainExamplesVisible(entry.isIntersecting))
    observer.observe(section)
    return () => observer.disconnect()
  }, [examples, activeSelection])
  const inspected = useMemo(() => activeSelection ? sampleChords(constraints, 20, activeSelection) : [], [constraints, activeSelection])

  const previewChords = activeSelection ? inspected : examples
  const selectedType = summary.find(row => row.intervals.join('–') === activeSelection)?.type
  const previewLabel = activeSelection ? `${selectedType && selectedType !== '—' ? `${selectedType} · ` : ''}${activeSelection}` : 'Examples'
  function navigateTo(element: HTMLElement | null) {
    if (!element) return
    element.focus({ preventScroll: true })
    element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }
  return (
    <main>
      <div className="sticky-count">
        <div className="autoplay-control"><button type="button" aria-pressed={autoplayEnabled} aria-keyshortcuts="a" onClick={() => setAutoplayEnabled(current => !current)}>Random autoplay: {autoplayEnabled ? 'Playing' : 'Stopped'} <kbd>A</kbd></button><label>Interval <select value={autoplayInterval} onChange={event => setAutoplayInterval(Number(event.target.value) as AutoplayInterval)}>{AUTOPLAY_INTERVALS.map(interval => <option key={interval} value={interval}>{interval / 1000} s</option>)}</select></label>{autoplayEnabled && examples.length === 0 && <small role="status">No matching chords.</small>}</div>
        <span aria-live="polite">Remaining: {result.capped ? '>10,000' : result.count.toLocaleString('en-US')}</span>
      </div>
      <h1>Chord-space explorer</h1>
      <p>Change constraints to narrow the space of possible chords.</p>
      <MidiTest midi={midi} />
      <table className="constraints">
        <caption>Constraints</caption>
        <tbody>
          <tr><th scope="row"><label htmlFor="voices">Number of voices</label></th><td>
            <select id="voices" value={voices} onChange={e => updatePitchSelection(Number(e.target.value), pitchClasses)}>
              {Array.from({ length: 8 }, (_, i) => i + 1).map(n => <option key={n}>{n}</option>)}
            </select>
          </td></tr>
          <tr><th scope="row"><label htmlFor="structure">Interval structure</label></th><td>
            <select id="structure" value={structure} onChange={e => setStructure(e.target.value as Structure)}>
              {Object.entries(structures).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <p><small>Relative to a reference pitch, in semitones. Matches any transposition; 0 does not mean C.</small></p>
          </td></tr>
          <tr><th scope="row"><label htmlFor="chord-type">Chord type</label></th><td>
            <select id="chord-type" value={structure} onChange={e => setStructure(e.target.value as Structure)}>
              <option value="any">Any</option>{Object.entries(chordTypes).map(([value,type]) => <option key={value} value={value}>{type.label}</option>)}
            </select>
            <p><small>Another representation of the same interval-structure constraint.</small></p>
          </td></tr>
          <tr><th scope="row">Key &amp; Scale</th><td>
            <div className="key-scale-controls">
              <label>Tonic <select value={tonic} onChange={event => setTonic(Number(event.target.value))}>{names.map((name,pc) => <option key={pc} value={pc}>{name}</option>)}</select></label>
              <label>Scale <select value={scaleMode} onChange={event => setScaleMode(event.target.value as ScaleMode)}><option value="major">Major</option><option value="naturalMinor">Natural minor</option></select></label>
            </div>
            <p className="scale-notes">{scaleNotes.map(pc => names[pc]).join(' – ')}</p>
            <label className="scale-restriction"><input type="checkbox" checked={restrictScale} onChange={event => setRestrictScale(event.target.checked)} /> Only chords using notes from this scale</label>
          </td></tr>
          <tr><th scope="row"><label htmlFor="root">Root</label></th><td>
            <select id="root" value={root ?? 'any'} onChange={event => setRoot(event.target.value === 'any' ? null : Number(event.target.value))}>
              <option value="any">Any</option>
              {names.map((name, pc) => <option key={pc} value={pc}>{name}</option>)}
            </select>
            <p><small>Fixes the unique reference of the selected type, or the normalized structure when Any is selected, independently of the bass. A fixed root excludes structures with ambiguous references.</small></p>
          </td></tr>
          <tr><th scope="row"><label htmlFor="inversion">Inversion</label></th><td>
            <select id="inversion" value={activeInversion ?? 'any'} onChange={event => setInversion(event.target.value === 'any' ? null : Number(event.target.value))}>
              <option value="any">Any</option>
              {Array.from({ length: structuralSize }, (_, member) => <option key={member} value={member}>{inversionLabel(member)}</option>)}
            </select>
            <p><small>Member of the selected type’s interval structure in the bass; with Any, uses the normalized structure. Symmetric structures may have equivalent references.</small></p>
          </td></tr>
          <tr><th scope="row">Pitch classes</th><td>
            <div className="pitch-classes" role="group" aria-label="Pitch classes">
              {names.map((name, pc) => <label key={pc}><input type="checkbox" checked={pitchClasses.includes(pc)} disabled={pitchClassDisabled(pc, pitchClasses, voices)} onChange={e => updatePitchSelection(voices, e.target.checked ? [...pitchClasses, pc] : pitchClasses.filter(value => value !== pc))} />{name}</label>)}
            </div>
            <small>Require these pitch classes. None selected means no pitch-class requirement.</small>
          </td></tr>
          <tr><th scope="row">Pitch range</th><td className="range">
            <label>Lowest pitch <select value={low} onChange={e => setLow(Number(e.target.value))}>{pitches.map(n => <option key={n} value={n}>{noteName(n)}</option>)}</select></label>
            <span>to</span>
            <label>Highest pitch <select value={high} onChange={e => setHigh(Number(e.target.value))}>{pitches.map(n => <option key={n} value={n}>{noteName(n)}</option>)}</select></label>
          </td></tr>
          <tr><th scope="row"><label htmlFor="distinct">Number of distinct pitch classes</label></th><td>
            <select id="distinct" value={derivedDistinct || distinct} disabled={derivedDistinct > 0} aria-describedby={derivedDistinct ? 'derived-distinct' : undefined} onChange={e => setDistinct(Number(e.target.value))}>
              <option value={0}>Any</option>
              {Array.from({ length: voices }, (_, i) => i + 1).map(n => <option key={n} disabled={n < pitchClasses.length}>{n}</option>)}
            </select>
            {derivedDistinct > 0 && <p id="derived-distinct"><small>The interval structure requires {typeSize} distinct pitch classes. Incompatible voice counts or required pitch classes give zero possibilities.</small></p>}
          </td></tr>
        </tbody>
      </table>
      <p className="definition">Each chord uses different pitches, ordered low to high. Octave doubling is allowed; repeating the same pitch is excluded. Range endpoints are included. Tuning: fixed 12-tone equal temperament.</p>
      <section aria-label="Results">

            <section aria-label="Structures in this space">
              <h2 className="structure-heading"><button type="button" aria-expanded={structuresOpen} aria-controls="structure-table-content" onClick={() => setStructuresOpen(open => !open)}>Structures in this space <span className="structure-count">{summary.length} {summary.length === 1 ? 'structure' : 'structures'}</span><span aria-hidden="true">{structuresOpen ? '−' : '+'}</span></button></h2>
              <div id="structure-table-content" hidden={!structuresOpen}>
              <p>Counts of distinct pitch-class sets across the entire constrained space, independent of the concrete examples below.</p>
              <p><small>Normalization uses the smallest enclosing span, then the lexicographically smallest interval sequence across reference pitches. Transpositions are grouped; inversions are not.</small></p>
              <p><small>Click a row to inspect up to 20 varied voicings without changing the global constraints.</small></p>
              <div className="summary-scroll"><table className="summary">
                <thead><tr><th scope="col">Interval structure</th><th scope="col"><button type="button" aria-pressed={commonFirst} onClick={() => setCommonFirst(current => !current)} title="Toggle conventional types first">Conventional type<span aria-hidden="true"> {commonFirst ? '↑' : '↕'}</span></button></th><th scope="col">Pitch-class sets</th><th scope="col">Examples</th></tr></thead>
                <tbody>{orderedSummary.map(row => <tr key={row.intervals.join(',')} ref={activeSelection === row.intervals.join('–') ? selectedRow : undefined} tabIndex={-1} className={activeSelection === row.intervals.join('–') ? 'selected' : ''} onClick={() => setSelected(row.intervals.join('–'))}><td><button type="button" aria-pressed={activeSelection === row.intervals.join('–')} onClick={() => setSelected(row.intervals.join('–'))}>{row.intervals.join('–')}</button></td><td>{row.type}</td><td>{row.pitchClassSets}</td><td>{row.examples.map(pcs => pcs.map(pc => names[pc]).join('–')).join(' · ')}</td></tr>)}</tbody>
              </table></div>
              </div>
            </section>
        {low > high ? <p role="alert">Choose a lowest pitch at or below the highest pitch.</p>
          : result.count === 0 ? <p>No chords match these constraints.</p>
          : <>
            {result.capped && <p>Counting stopped at the 10,001st match. Narrow the constraints to see an exact count.</p>}
            {activeSelection && <section ref={inspectionSection} tabIndex={-1} className="inspection-section" aria-label="Inspected chord examples">
              <h2>{inspected.length < 20 ? `All ${inspected.length} chords from ${activeSelection}` : `20 chord examples from ${activeSelection}`}</h2>
              <button type="button" onClick={() => { setStructuresOpen(true); requestAnimationFrame(() => navigateTo(selectedRow.current)) }}>Back to structure ↑</button>
              <ul className="chords">{inspected.map(chord => <li key={chord.join(',')}><button type="button" className="play-chord" onClick={() => midi.play(chord)} title="Play this voicing through MIDI">{chord.map(noteName).join(' – ')}</button></li>)}</ul>
            </section>}
            <section ref={examplesSection} aria-label="Concrete chord examples">
            <h2>Concrete chord examples</h2>
            <p>{result.count <= 100 ? `Showing all ${result.count} chords` : `Showing ${examples.length} examples`}</p>
            <ul className="chords">{examples.map(chord => <li key={chord.join(',')}><button type="button" className="play-chord" onClick={() => midi.play(chord)} title="Play this voicing through MIDI">{chord.map(noteName).join(' – ')}</button></li>)}</ul>
            </section>
          </>}
      </section>
      <footer>{__DEPLOY_ENV__} · {__GIT_COMMIT__} · v{__APP_VERSION__}</footer>
      <aside className={`bottom-preview${mainExamplesVisible ? ' preview-hidden' : ''}`} aria-label="Chord preview" aria-hidden={mainExamplesVisible}>
        <div className="preview-heading"><span>{previewLabel}</span>{activeSelection && <button type="button" onClick={() => navigateTo(inspectionSection.current)}>View {inspected.length} ↓</button>}</div>
        {previewChords.length === 0 ? <p>No matching chords.</p> : <ul>{previewChords.slice(0, 5).map(chord => <li key={chord.join(',')}><button type="button" className="play-chord" onClick={() => midi.play(chord)} title="Play this voicing through MIDI">{chord.map(noteName).join(' – ')}</button></li>)}</ul>}
      </aside>
    </main>
  )
}
export default App
