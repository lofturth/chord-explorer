export const TEST_NOTES = [60, 64, 67] as const
export const TEST_DURATION = 1500

export interface MidiSender {
  send(data: number[], timestamp?: number): void
}

// Channel 1, fixed velocity. Schedule releases on the MIDI queue rather than
// relying on a background-tab JavaScript timer to stop the notes.
export function sendTestChord(output: MidiSender, now: number = performance.now()): void {
  try {
    for (const note of TEST_NOTES) {
      output.send([0x90, note, 80], now)
      output.send([0x80, note, 0], now + TEST_DURATION)
    }
  } catch (error) {
    // Best-effort release if a port fails partway through queuing the chord.
    for (const note of TEST_NOTES) {
      try { output.send([0x80, note, 0]) } catch { /* Disconnected ports cannot receive cleanup. */ }
    }
    throw error
  }
}

// Concrete chords already contain MIDI integers: no note-name parsing or octave
// conversion belongs in playback. Copy only to keep the caller's chord immutable.
export function concreteMidiNotes(chord: readonly number[]): number[] {
  if (chord.some(note => !Number.isInteger(note) || note < 0 || note > 127)) throw new Error('Invalid concrete MIDI pitch.')
  return [...chord]
}

export const PERFORMANCE_RANGE = { timingMeanMs: 0, timingStandardDeviationMs: 15, velocityMean: 38, velocityStandardDeviation: 15 } as const

function sampleGaussian(random: () => number): number {
  // 1 - random() is in (0, 1], keeping log() finite even for a zero draw.
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
}

export function sampleTimingOffset(random: () => number = Math.random): number {
  return PERFORMANCE_RANGE.timingMeanMs + PERFORMANCE_RANGE.timingStandardDeviationMs * sampleGaussian(random)
}

export function normalizeOnsets(offsets: readonly number[]): number[] {
  if (!offsets.length) return []
  const earliest = Math.min(...offsets)
  return offsets.map(offset => offset - earliest)
}

export function sampleVelocity(random: () => number = Math.random): number {
  const gaussian = sampleGaussian(random)
  const velocity = Math.round(PERFORMANCE_RANGE.velocityMean + PERFORMANCE_RANGE.velocityStandardDeviation * gaussian)
  return Math.max(1, Math.min(127, velocity))
}

export function randomPerformance(chord: readonly number[], random: () => number = Math.random) {
  const notes = concreteMidiNotes(chord)
  const onsets = normalizeOnsets(notes.map(() => sampleTimingOffset(random)))
  return notes.map((note, index) => ({
    note,
    onsetMs: onsets[index],
    velocity: sampleVelocity(random),
  }))
}

export interface PlaybackOutput extends MidiSender { clear?(): void }
export function createChordPlayer(
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> = setTimeout,
  cancel: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout,
  random: () => number = Math.random,
) {
  let active: { output: PlaybackOutput; notes: number[] } | null = null
  let timers: ReturnType<typeof setTimeout>[] = []
  function stop() {
    const previous = active
    active = null
    for (const timer of timers) cancel(timer)
    timers = []
    if (!previous) return
    let failure: unknown
    try { previous.output.clear?.() } catch (error) { failure = error }
    for (const note of previous.notes) {
      try { previous.output.send([0x80, note, 0]) } catch (error) { failure = error }
    }
    if (failure) throw failure
  }
  function play(output: PlaybackOutput, chord: readonly number[], _now: number = performance.now()) {
    const performance = randomPerformance(chord, random)
    stop()
    const audition = { output, notes: [] as number[] }
    active = audition
    for (const event of performance) {
      // Keep delayed attacks out of the device queue: even ports without clear()
      // can cancel them. Identity checks also reject already-dispatched callbacks.
      timers.push(schedule(() => {
        if (active !== audition) return
        audition.notes.push(event.note)
        try {
          output.send([0x90, event.note, event.velocity])
          timers.push(schedule(() => {
            if (active !== audition) return
            try { output.send([0x80, event.note, 0]) } catch { /* Disconnected port. */ }
            audition.notes = audition.notes.filter(note => note !== event.note)
          }, TEST_DURATION))
        } catch {
          try { stop() } catch { /* Disconnected port. */ }
        }
      }, event.onsetMs))
    }
  }
  return { play, stop }
}
