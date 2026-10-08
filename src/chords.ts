import { selectedIntervals } from './chordTypes.ts'
import type { Structure } from './chordTypes.ts'
export { structures } from './chordTypes.ts'
export type { Structure } from './chordTypes.ts'
import { inversionBassClasses, structuralRoot } from './pitchStructure.ts'
export interface Constraints {
  voices: number
  low: number
  high: number
  distinct: number | null
  pitchClasses?: number[]
  structure?: Structure
  inversion?: number | null
  root?: number | null
}
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
export function enumerateChords({ voices, low, high, distinct, pitchClasses = [], structure = 'any', inversion = null, root = null }: Constraints) {
  const intervals = selectedIntervals(structure)
  const size = intervals?.length
  const chords: number[][] = []
  const inversionMasks = new Map<number, number>()
  const rootMatches = new Map<number, boolean>()
  let count = 0
  if (root !== null && (!Number.isInteger(root) || root < 0 || root > 11)) return { count, capped: false, chords }
  // Reject ambiguous fixed-root types before visiting any concrete voicings.
  if (root !== null && intervals && structuralRoot(intervals.map(interval => (root + interval) % 12), intervals) !== root) return { count, capped: false, chords }
  const selectedMask = pitchClasses.reduce((mask, pc) => mask | (1 << pc), 0)
  const selectedCount = bitCount(selectedMask)
  if (inversion !== null && (!Number.isInteger(inversion) || inversion < 0 || inversion >= voices || (distinct !== null && inversion >= distinct) || (size !== undefined && inversion >= size))) return { count, capped: false, chords }
  if (pitchClasses.some(pc => !Number.isInteger(pc) || pc < 0 || pc > 11) || selectedCount > voices || (distinct !== null && distinct < selectedCount)) return { count, capped: false, chords }
  const references = root === null ? Array.from({ length: 12 }, (_, pc) => pc) : [root]
  const structureMasks = structure === 'any' ? [] : references.map(reference =>
    intervals!.reduce((mask, interval) => mask | (1 << ((reference + interval) % 12)), 0))
  if (structure !== 'any' && ((distinct !== null && distinct !== size) || !structureMasks.some(mask => (mask & selectedMask) === selectedMask))) return { count, capped: false, chords }
  const targetDistinct = size ?? distinct
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
    if (bitCount(selectedMask & ~mask) > remaining) return false
    // Only pursue partial voicings that can complete a supported transposition.
    if (structureMasks.length && !structureMasks.some(target => (mask & target) === mask && ((mask | (suffixMasks[start] ?? 0)) & target) === target)) return false
    if (root !== null && !((mask | (suffixMasks[start] ?? 0)) & (1 << root))) return false
    if (remaining === 0) {
      if (root !== null) {
        let matches = rootMatches.get(mask)
        if (matches === undefined) {
          const pcs = Array.from({length:12},(_,pc)=>pc).filter(pc=>mask & (1 << pc))
          matches = structuralRoot(pcs, intervals) === root
          rootMatches.set(mask,matches)
        }
        if (!matches) return false
      }
      if (inversion !== null) {
        let bassMask = inversionMasks.get(mask)
        if (bassMask === undefined) {
          const pcs = Array.from({length:12},(_,pc)=>pc).filter(pc=>mask & (1 << pc))
          bassMask = inversionBassClasses(pcs, inversion, intervals).reduce((bits,pc)=>bits | (1 << pc),0)
          inversionMasks.set(mask,bassMask)
        }
        if (!(bassMask & (1 << (chord[0] % 12)))) return false
      }
      count++
      if (count <= EXAMPLE_LIMIT) chords.push([...chord])
      return count > COUNT_LIMIT
    }
    for (let pitch = start; pitch <= high - remaining + 1; pitch++) {
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
