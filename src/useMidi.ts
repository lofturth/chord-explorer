import { useEffect, useRef, useState } from 'react'
import { createChordPlayer } from './midi'
import type { PlaybackOutput } from './midi'
import { noteName } from './chords'

export function useMidi() {
  const [access, setAccess] = useState<MIDIAccess | null>(null)
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [selected, setSelected] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [status, setStatus] = useState('Request access to list MIDI outputs.')
  const player = useRef(createChordPlayer())
  const requestVersion = useRef(0)
  const supported = typeof navigator.requestMIDIAccess === 'function'
  function stop() {
    requestVersion.current++
    try { player.current.stop() } catch { /* Device disconnected. */ }
  }
  useEffect(() => {
    if (!access) return
    function refresh() {
      const ports = [...access!.outputs.values()].filter(port => port.state === 'connected')
      setOutputs(ports)
      setSelected(current => ports.some(port => port.id === current) ? current : '')
    }
    refresh()
    access.addEventListener('statechange', refresh)
    return () => access.removeEventListener('statechange', refresh)
  }, [access])
  useEffect(() => { stop(); return stop }, [selected])
  async function requestAccess() {
    setRequesting(true)
    try {
      setAccess(await navigator.requestMIDIAccess({ sysex: false }))
      setStatus('MIDI access granted. Select an output to test.')
    } catch (error) {
      setStatus(`MIDI access failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally { setRequesting(false) }
  }
  async function play(chord: readonly number[]) {
    stop()
    const version = requestVersion.current
    const output = outputs.find(port => port.id === selected)
    if (!output) { setStatus('Select a connected MIDI output to play chords.'); return }
    try {
      await output.open()
      if (version !== requestVersion.current) return
      const playbackOutput = output as MIDIOutput & PlaybackOutput
      player.current.play(playbackOutput, chord)
      setStatus(`Playing ${chord.map(noteName).join('–')} through ${output.name || 'selected output'} for 1.5 seconds.`)
    } catch (error) {
      setStatus(`MIDI send failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { access, outputs, selected, setSelected, requesting, status, supported, requestAccess, play, stop }
}
