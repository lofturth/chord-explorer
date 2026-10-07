import { structures } from './chords.ts'
import type { Constraints } from './chords.ts'

export interface StructureSummary {
  intervals: number[]
  type: 'Major' | 'Minor' | '—'
  pitchClassSets: number
  examples: number[][]
}

// Transposition only (never inversion): choose the rotation with the smallest
// enclosing span, then the lexicographically smallest interval sequence.
// This preserves 0–4–7 and 0–3–7 without inferring any other conventional roots.
export function normalizePitchClasses(pcs: number[]): number[] {
  const unique = [...new Set(pcs)]
  const rotations = unique.map(reference => unique.map(pc => (pc - reference + 12) % 12).sort((a, b) => a - b))
  rotations.sort((a, b) => {
    const span = a[a.length - 1] - b[b.length - 1]
    if (span) return span
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
    return 0
  })
  return rotations[0] ?? []
}

// A set is realizable iff each class has a pitch in the range, it has at most
// `voices` classes, and its available distinct MIDI pitches can fill all voices.
// No concrete voicing enumeration is needed to prove this for current constraints.
export function feasiblePitchClassSets({ voices, low, high, distinct, pitchClasses = [], structure = 'any' }: Constraints): number[][] {
  if (![voices, low, high].every(Number.isInteger) || voices < 1 || voices > 8 || low < 0 || high > 127 || low > high ||
    (distinct !== null && (!Number.isInteger(distinct) || distinct < 1 || distinct > 12)) ||
    pitchClasses.some(pc => !Number.isInteger(pc) || pc < 0 || pc > 11)) return []
  const capacity = Array<number>(12).fill(0)
  for (let pitch = low; pitch <= high; pitch++) capacity[pitch % 12]++
  const selectedMask = pitchClasses.reduce((mask, pc) => mask | (1 << pc), 0)
  const sets: number[][] = []
  for (let mask = 1; mask < 4096; mask++) {
    if (selectedMask && mask !== selectedMask) continue
    const pcs = Array.from({ length: 12 }, (_, pc) => pc).filter(pc => mask & (1 << pc))
    if (pcs.length > voices || (distinct !== null && pcs.length !== distinct) || pcs.some(pc => capacity[pc] === 0) || pcs.reduce((sum, pc) => sum + capacity[pc], 0) < voices) continue
    const intervals = normalizePitchClasses(pcs)
    const key = intervals.join('–')
    if (structure !== 'any' && key !== structures[structure]) continue
    sets.push(pcs)
  }
  return sets
}

export function summarizeStructures(constraints: Constraints): StructureSummary[] {
  const groups = new Map<string, StructureSummary>()
  for (const pcs of feasiblePitchClassSets(constraints)) {
    const intervals = normalizePitchClasses(pcs)
    const key = intervals.join('–')
    let group = groups.get(key)
    if (!group) {
      group = { intervals, type: key === structures.major ? 'Major' : key === structures.minor ? 'Minor' : '—', pitchClassSets: 0, examples: [] }
      groups.set(key, group)
    }
    group.pitchClassSets++
    if (group.examples.length < 3) group.examples.push(pcs)
  }
  return [...groups.values()].sort((a, b) => a.intervals.length - b.intervals.length || a.intervals.join(',').localeCompare(b.intervals.join(','), 'en', { numeric: true }))
}

export function availableSelection(selected: string | null, summary: StructureSummary[]): string | null {
  return summary.some(row => row.intervals.join('–') === selected) ? selected : null
}

// Presentation only: retain normal order within both groups without mutating rows.
export function orderSummaryRows(rows: StructureSummary[], commonFirst: boolean): StructureSummary[] {
  return commonFirst ? [...rows.filter(row => row.type !== '—'), ...rows.filter(row => row.type === '—')] : rows
}
