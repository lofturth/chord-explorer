import { selectedIntervals } from './chordTypes.ts'
import { feasibleInversionBasses } from './pitchStructure.ts'
import type { Constraints } from './chords.ts'
import { feasiblePitchClassSets, normalizePitchClasses } from './summary.ts'

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Sample feasible class sets and octave choices, rather than a prefix of the
// bounded counter. This favors musical variety, not uniform voicing probability.
export function sampleChords(constraints: Constraints, limit: number, selected: string | null = null, random: () => number = Math.random): number[][] {
  const sets = feasiblePitchClassSets(constraints).filter(pcs => selected === null || normalizePitchClasses(pcs).join('–') === selected)
  if (!sets.length || limit <= 0) return []
  const pools = sets.map(pcs => ({ basses: constraints.inversion == null ? [] : feasibleInversionBasses(pcs, constraints.voices, constraints.low, constraints.high, constraints.inversion, selectedIntervals(constraints.structure ?? 'any')), pool: pcs.map(pc => {
    const notes: number[] = []
    for (let n = constraints.low; n <= constraints.high; n++) if (n % 12 === pc) notes.push(n)
    return notes
  }) }))
  const unique = new Map<string, number[]>()
  function add(notes: number[]) {
    notes.sort((a, b) => a - b)
    unique.set(notes.join(','), notes)
  }
  for (let attempt = 0; attempt < limit * 50 && unique.size < limit; attempt++) {
    const entry = pools[Math.floor(random() * pools.length)]
    const bass = entry.basses.length ? entry.basses[Math.floor(random()*entry.basses.length)] : null
    const pool = entry.pool.map(group => bass === null ? group : group.filter(note => note >= bass))
    const notes = pool.map(group => bass !== null && group.includes(bass) ? bass : group[Math.floor(random() * group.length)])
    const extras = shuffled(pool.flat().filter(n => !notes.includes(n)), random)
    add([...notes, ...extras.slice(0, constraints.voices - notes.length)])
  }
  // Collisions are common in small spaces. Complete the sample with a bounded
  // search, stopping as soon as it is full; exhaustion means all chords are shown.
  for (const entry of shuffled(pools, random)) {
    for (const bass of entry.basses.length ? shuffled(entry.basses, random) : [null]) {
      const pool = entry.pool
      if (unique.size >= limit) break
      const candidates = shuffled(pool.flat().filter(note => bass === null || note > bass), random)
      const pcs = pool.map(group => group[0] % 12)
      const targetMask = pcs.reduce((mask, pc) => mask | (1 << pc), 0)
      const suffixMasks = Array<number>(candidates.length + 1).fill(0)
      for (let i = candidates.length - 1; i >= 0; i--) suffixMasks[i] = suffixMasks[i + 1] | (1 << (candidates[i] % 12))
      function visit(start: number, notes: number[], mask: number): void {
        if (unique.size >= limit) return
        const remaining = constraints.voices - notes.length
        if (pcs.filter(pc => !(mask & (1 << pc))).length > remaining || ((mask | suffixMasks[start]) & targetMask) !== targetMask) return
        if (remaining === 0) {
          if (pcs.every(pc => mask & (1 << pc))) add([...notes])
          return
        }
        for (let i = start; i <= candidates.length - remaining && unique.size < limit; i++) {
          visit(i + 1, [...notes, candidates[i]], mask | (1 << (candidates[i] % 12)))
        }
      }
      visit(0, bass === null ? [] : [bass], bass === null ? 0 : (1 << (bass % 12)))
    }
  }
  return shuffled([...unique.values()], random)
}
