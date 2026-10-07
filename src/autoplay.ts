export function chooseAutoplayChord(candidates: readonly number[][], random: () => number = Math.random): number[] | null {
  return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null
}

// Read candidates at each tick; never retain a queue or a stale constraint snapshot.
export function createAutoplay(
  candidates: () => readonly number[][],
  audition: (chord: number[]) => void,
  release: () => void,
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setInterval> = setInterval,
  cancel: (timer: ReturnType<typeof setInterval>) => void = clearInterval,
  random: () => number = Math.random,
) {
  let timer: ReturnType<typeof setInterval> | null = null
  let generation = 0
  let interval: AutoplayInterval = DEFAULT_AUTOPLAY_INTERVAL
  function start(nextInterval: AutoplayInterval = DEFAULT_AUTOPLAY_INTERVAL) {
    if (timer !== null && interval === nextInterval) return
    const current = ++generation
    if (timer !== null) cancel(timer)
    interval = nextInterval
    timer = schedule(() => {
      if (current !== generation) return
      const chord = chooseAutoplayChord(candidates(), random)
      if (chord) audition(chord)
    }, interval)
  }
  function stop() {
    generation++
    if (timer !== null) cancel(timer)
    timer = null
    release()
  }
  return { start, stop }
}
export const AUTOPLAY_INTERVALS = [250, 500, 1000, 2000] as const
export type AutoplayInterval = typeof AUTOPLAY_INTERVALS[number]
export const DEFAULT_AUTOPLAY_INTERVAL: AutoplayInterval = 1000
