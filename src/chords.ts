export interface Constraints {
  voices: number
  low: number
  high: number
  distinct: number | null
  pitchClasses?: number[]
  structure?: Structure
}
export type Structure = 'any' | 'major' | 'minor'
export const structures = { any: 'Any', major: '0–4–7', minor: '0–3–7' } as const
export const COUNT_LIMIT = 10_000
export const EXAMPLE_LIMIT = 100
export const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
export function noteName(midi: number): string {
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`
}
function bitCount(mask: number): number {
  let count = 0
  while (mask) { mask &= mask - 1; count++ }
  return count
}
// Increasing MIDI sequences represent each unordered voicing exactly once.
export function enumerateChords({ voices, low, high, distinct, pitchClasses = [], structure = 'any' }: Constraints) {
  const chords: number[][] = []
  let count = 0
  const selectedMask = pitchClasses.reduce((mask, pc) => mask | (1 << pc), 0)
  const selectedCount = bitCount(selectedMask)
  if (pitchClasses.some(pc => !Number.isInteger(pc) || pc < 0 || pc > 11) || (selectedMask && distinct !== null && distinct !== selectedCount)) return { count, capped: false, chords }
  const structureMasks = structure === 'any' ? [] : Array.from({ length: 12 }, (_, root) =>
    [0, structure === 'major' ? 4 : 3, 7].reduce((mask, interval) => mask | (1 << ((root + interval) % 12)), 0))
  if (structure !== 'any' && ((distinct !== null && distinct !== 3) || (selectedMask && !structureMasks.includes(selectedMask)))) return { count, capped: false, chords }
  const targetDistinct = selectedMask ? selectedCount : structure !== 'any' ? 3 : distinct
  if (![voices, low, high].every(Number.isInteger) || voices < 1 || voices > 8 || low < 0 || high > 127 || low > high || (distinct !== null && (!Number.isInteger(distinct) || distinct < 1 || distinct > Math.min(12, voices)))) {
    return { count, capped: false, chords }
  }
  const suffixMasks = new Array<number>(high + 2).fill(0)
  for (let pitch = high; pitch >= low; pitch--) suffixMasks[pitch] = suffixMasks[pitch + 1] | (1 << (pitch % 12))
  const chord: number[] = []
  function visit(start: number, mask: number): boolean {
    const remaining = voices - chord.length
    const classes = bitCount(mask)
    if (targetDistinct !== null && (classes > targetDistinct || classes + remaining < targetDistinct || bitCount(mask | (suffixMasks[start] ?? 0)) < targetDistinct)) return false
    if (selectedMask && ((mask | (suffixMasks[start] ?? 0)) & selectedMask) !== selectedMask) return false
    // Only pursue partial voicings that can complete a supported transposition.
    if (structureMasks.length && !structureMasks.some(target => (mask & target) === mask && ((mask | (suffixMasks[start] ?? 0)) & target) === target)) return false
    if (remaining === 0) {
      count++
      if (count <= EXAMPLE_LIMIT) chords.push([...chord])
      return count > COUNT_LIMIT
    }
    for (let pitch = start; pitch <= high - remaining + 1; pitch++) {
      if (selectedMask && !(selectedMask & (1 << (pitch % 12)))) continue
      const nextMask = mask | (1 << (pitch % 12))
      if (targetDistinct !== null && bitCount(nextMask) > targetDistinct) continue
      chord.push(pitch)
      const stop = visit(pitch + 1, nextMask)
      chord.pop()
      if (stop) return true
    }
    return false
  }
  visit(low, 0)
  return { count, capped: count > COUNT_LIMIT, chords }
}
