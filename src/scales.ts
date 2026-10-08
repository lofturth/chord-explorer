export const scaleOffsets = {
  major: [0,2,4,5,7,9,11],
  naturalMinor: [0,2,3,5,7,8,10],
} as const
export type ScaleMode = keyof typeof scaleOffsets
export interface ScaleConstraint { tonic: number; mode: ScaleMode }

export function scalePitchClasses({tonic,mode}: ScaleConstraint): number[] {
  if (!Number.isInteger(tonic) || tonic < 0 || tonic > 11 || !scaleOffsets[mode]) return []
  return scaleOffsets[mode].map(interval => (tonic+interval)%12)
}

// Absence means informational-only/off; it cannot change the chord space.
export function scaleMask(scale?: ScaleConstraint | null): number {
  return scale == null ? 4095 : scalePitchClasses(scale).reduce((mask,pc)=>mask | (1 << pc),0)
}
