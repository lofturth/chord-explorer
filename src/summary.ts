import { structures } from './chords.ts'
import type { Constraints } from './chords.ts'

export interface StructureSummary {
  intervals: number[]
  type: 'Major triad' | 'Minor triad' | '—'
  pitchClassSets: number
  examples: number[][]
}

export { normalizePitchClasses } from './pitchStructure.ts'
import { normalizePitchClasses, feasibleInversionBasses, structuralRoot } from './pitchStructure.ts'

// A set is realizable iff each class has a pitch in the range, it has at most
// `voices` classes, and its available distinct MIDI pitches can fill all voices.
// No concrete voicing enumeration is needed to prove this for current constraints.
export function feasiblePitchClassSets({ voices, low, high, distinct, pitchClasses = [], structure = 'any', inversion = null, root = null }: Constraints): number[][] {
  if (![voices, low, high].every(Number.isInteger) || voices < 1 || voices > 8 || low < 0 || high > 127 || low > high ||
    (distinct !== null && (!Number.isInteger(distinct) || distinct < 1 || distinct > 12)) ||
    (root !== null && (!Number.isInteger(root) || root < 0 || root > 11)) ||
    pitchClasses.some(pc => !Number.isInteger(pc) || pc < 0 || pc > 11)) return []
  const capacity = Array<number>(12).fill(0)
  for (let pitch = low; pitch <= high; pitch++) capacity[pitch % 12]++
  const selectedMask = pitchClasses.reduce((mask, pc) => mask | (1 << pc), 0)
  const sets: number[][] = []
  for (let mask = 1; mask < 4096; mask++) {
    if ((mask & selectedMask) !== selectedMask) continue
    const pcs = Array.from({ length: 12 }, (_, pc) => pc).filter(pc => mask & (1 << pc))
    if (pcs.length > voices || (distinct !== null && pcs.length !== distinct) || pcs.some(pc => capacity[pc] === 0) || pcs.reduce((sum, pc) => sum + capacity[pc], 0) < voices) continue
    const intervals = normalizePitchClasses(pcs)
    const key = intervals.join('–')
    if (structure !== 'any' && key !== structures[structure]) continue
    if (root !== null && structuralRoot(pcs) !== root) continue
    if (inversion !== null && !feasibleInversionBasses(pcs, voices, low, high, inversion).length) continue
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
      group = { intervals, type: key === structures.major ? 'Major triad' : key === structures.minor ? 'Minor triad' : '—', pitchClassSets: 0, examples: [] }
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
