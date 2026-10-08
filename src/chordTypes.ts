// One bounded vocabulary shared by the controls and constraint model.
export const chordTypes = {
  major: { label: 'Major triad', intervals: [0,4,7] },
  minor: { label: 'Minor triad', intervals: [0,3,7] },
  diminished: { label: 'Diminished triad', intervals: [0,3,6] },
  augmented: { label: 'Augmented triad', intervals: [0,4,8] },
  sus2: { label: 'Sus2', intervals: [0,2,7] },
  sus4: { label: 'Sus4', intervals: [0,5,7] },
  dominant7: { label: 'Dominant 7th', intervals: [0,4,7,10] },
  major7: { label: 'Major 7th', intervals: [0,4,7,11] },
  minor7: { label: 'Minor 7th', intervals: [0,3,7,10] },
} as const
export type Structure = 'any' | keyof typeof chordTypes
export const structures = {
  any: 'Any',
  ...Object.fromEntries(Object.entries(chordTypes).map(([key,type])=>[key,type.intervals.join('–')])),
}
export function selectedIntervals(structure: Structure): readonly number[] | undefined {
  return structure === 'any' ? undefined : chordTypes[structure].intervals
}
