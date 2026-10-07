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
