// Keep the earliest selected requirements when fewer voices are available.
export function reconcilePitchSelection(voices: number, pitchClasses: number[], distinct: number) {
  const required = [...new Set(pitchClasses)].slice(0, voices)
  return { pitchClasses: required, distinct: distinct === 0 ? 0 : Math.min(voices, Math.max(required.length, distinct)) }
}

export function pitchClassDisabled(pc: number, pitchClasses: number[], voices: number): boolean {
  return !pitchClasses.includes(pc) && pitchClasses.length >= voices
}
