import type { MidiSender } from './midi'

export type TouchColumn = { touched: boolean; value: number }

export function createFiveVoicePlayer() {
  let output: MidiSender | undefined
  let pitches: number[] = []
  let touched = Array<boolean>(5).fill(false)
  let enabled = false
  let sustained = false
  let maxVelocity = 127
  const active = new Map<number, number>()
  function sustain(value: boolean) {
    if (!output) return
    // Set this before sending so partial failures still get pedal-up cleanup.
    sustained = value
    for (let i = 0; i < 5; i++) output.send([0xB1 + i, 64, value ? 127 : 0])
  }
  function release() {
    if (sustained) {
      sustained = false
      for (let i = 0; i < 5; i++) {
        try { output?.send([0xB1 + i, 64, 0]) } catch { /* Disconnected destination. */ }
      }
    }
    for (const [i, note] of active) {
      try { output?.send([0x81 + i, note, 0]) } catch { /* Disconnected destination. */ }
    }
    active.clear()
  }
  function configure(nextOutput: MidiSender | undefined, chord: readonly number[] | null, nextEnabled = chord?.length === 5) {
    const next = chord?.length === 5 ? [...chord].sort((a, b) => a - b) : []
    if (output === nextOutput && pitches.join(',') === next.join(',') && enabled === nextEnabled) return
    release()
    output = nextOutput
    pitches = next
    enabled = nextEnabled
    if (enabled) {
      try { sustain(true) } catch { release() }
    }
  }
  function update(columns: readonly TouchColumn[]) {
    try {
      // Process all lifts first, including lifts arriving with a new attack.
      columns.forEach((column, i) => {
        if (!column.touched && active.has(i)) {
          output?.send([0x81 + i, active.get(i)!, 0])
          active.delete(i)
        }
      })
      const attacking = enabled && output && pitches.length === 5 &&
        columns.some((column, i) => column.touched && !touched[i] && !active.has(i))
      if (attacking) {
        sustain(false)
        sustain(true)
      }
      columns.forEach((column, i) => {
        if (column.touched && enabled && output && pitches.length === 5 && (active.has(i) || !touched[i])) {
          output.send([0xD1 + i, Math.round(column.value * 127)])
          if (!active.has(i)) {
            active.set(i, pitches[i])
            output.send([0x91 + i, pitches[i], Math.round(1 + column.value * (maxVelocity - 1))])
          }
        }
      })
    } catch {
      release()
    }
    touched = columns.map(column => column.touched)
  }
  function disconnect() {
    release()
    touched.fill(false)
  }
  function setMaxVelocity(value: number) { maxVelocity = value }
  return { configure, update, disconnect, setMaxVelocity }
}
