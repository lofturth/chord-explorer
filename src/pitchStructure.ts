// Transposition normalization: smallest enclosing span, then lexicographic order.
export function structureReferences(pcs: readonly number[]) {
  const unique = [...new Set(pcs)]
  const rotations = unique.map(reference => ({ reference, intervals: unique.map(pc => (pc - reference + 12) % 12).sort((a, b) => a - b) }))
  rotations.sort((a, b) => {
    const span = a.intervals.at(-1)! - b.intervals.at(-1)!
    if (span) return span
    for (let i = 0; i < a.intervals.length; i++) if (a.intervals[i] !== b.intervals[i]) return a.intervals[i] - b.intervals[i]
    return a.reference - b.reference
  })
  const key = rotations[0]?.intervals.join(',')
  return rotations.filter(rotation => rotation.intervals.join(',') === key)
}

export function normalizePitchClasses(pcs: readonly number[]): number[] {
  return structureReferences(pcs)[0]?.intervals ?? []
}

// Only unique normalized references support fixed Root filtering. Symmetric sets
// remain available with Root=Any; no arbitrary conventional root is assigned.
export function structuralRoot(pcs: readonly number[]): number | null {
  const references = structureReferences(pcs)
  return references.length === 1 ? references[0].reference : null
}

export function inversionBassClasses(pcs: readonly number[], inversion: number): number[] {
  if (!Number.isInteger(inversion) || inversion < 0) return []
  return [...new Set(structureReferences(pcs).flatMap(({reference, intervals}) =>
    inversion < intervals.length ? [(reference + intervals[inversion]) % 12] : []))]
}

export function voicingInversions(notes: readonly number[]): number[] {
  if (!notes.length) return []
  const bass = Math.min(...notes) % 12
  const pcs = [...new Set(notes.map(note => note % 12))]
  return [...new Set(structureReferences(pcs).map(({reference, intervals}) => intervals.indexOf((bass-reference+12)%12)))]
}

// A bass is possible iff every other class occurs above it and enough distinct
// MIDI pitches remain to fill the voices. No enumeration of concrete chords.
export function feasibleInversionBasses(pcs: readonly number[], voices: number, low: number, high: number, inversion: number): number[] {
  const classes = inversionBassClasses(pcs, inversion)
  const result: number[] = []
  for (let bass = low; bass <= high; bass++) {
    if (!classes.includes(bass % 12)) continue
    const capacity = pcs.map(pc => {
      const first = bass + ((pc - bass % 12 + 12) % 12)
      return first > high ? 0 : Math.floor((high-first)/12)+1
    })
    if (capacity.every(count => count > 0) && capacity.reduce((sum,count)=>sum+count,0) >= voices) result.push(bass)
  }
  return result
}

export function inversionLabel(member: number): string {
  if (member === 0) return 'Root'
  return `${member}${member === 1 ? 'st' : member === 2 ? 'nd' : member === 3 ? 'rd' : 'th'}`
}
