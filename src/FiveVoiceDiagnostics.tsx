import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createFiveVoicePlayer } from './fiveVoiceMidi'
import type { MidiSender } from './midi'
import { noteName } from './chords'

type Column = { touched: boolean; value: number }
const cleared = (): Column[] => Array.from({ length: 5 }, () => ({ touched: false, value: 0 }))

export function FiveVoiceDiagnostics({ output, chord, onConnectionChange, enabled, maxVelocity }: {
  output?: MidiSender
  chord: readonly number[] | null
  onConnectionChange: (connected: boolean) => void
  enabled: boolean
  maxVelocity: number
}) {
  const [columns, setColumns] = useState(cleared)
  const [status, setStatus] = useState('Connecting to relay')
  const player = useRef(createFiveVoicePlayer())
  useLayoutEffect(() => { player.current.configure(output, chord, enabled) }, [output, chord, enabled])
  useLayoutEffect(() => { player.current.setMaxVelocity(maxVelocity) }, [maxVelocity])

  useEffect(() => {
    const controller = player.current
    const release = () => controller.disconnect()
    window.addEventListener('pagehide', release)
    let disposed = false
    let socket: WebSocket
    let retry: ReturnType<typeof setTimeout> | undefined

    function connect() {
      socket = new WebSocket('ws://127.0.0.1:8080/browser')
      socket.onopen = () => {
        if (!disposed) setStatus('Relay connected · waiting for phone status')
      }
      socket.onmessage = event => {
        if (disposed) return
        try {
          const message = JSON.parse(event.data)
          if (message?.type === 'status' && typeof message.iphoneConnected === 'boolean') {
            onConnectionChange(message.iphoneConnected)
            setStatus(message.iphoneConnected ? 'Phone connected' : 'Phone disconnected')
            if (!message.iphoneConnected) { controller.disconnect(); setColumns(cleared()) }
          } else if (Array.isArray(message?.columns) && message.columns.length === 5 &&
            message.columns.every((column: Column) => column && typeof column.touched === 'boolean' &&
              typeof column.value === 'number' && Number.isFinite(column.value) && column.value >= 0 && column.value <= 1)) {
            setColumns(message.columns)
            controller.update(message.columns)
          }
        } catch { /* Ignore malformed messages without changing the last valid state. */ }
      }
      socket.onerror = () => {
        if (disposed) return
        onConnectionChange(false)
        controller.disconnect()
        setColumns(cleared())
        setStatus('Relay disconnected · retrying')
        socket.close()
      }
      socket.onclose = () => {
        if (disposed) return
        onConnectionChange(false)
        controller.disconnect()
        setColumns(cleared())
        setStatus('Relay disconnected · retrying')
        retry = setTimeout(connect, 1000)
      }
    }
    connect()
    return () => {
      disposed = true
      window.removeEventListener('pagehide', release)
      controller.disconnect()
      clearTimeout(retry)
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      socket.close()
    }
  }, [onConnectionChange])

  return <section className="five-voice" aria-label="Five Voice diagnostics">
    <h2>Five Voice diagnostics</h2>
    <p role="status">{status}</p>
    <p>{!enabled ? 'iPhone playback is off.' : chord?.length === 5 ? `Selected: ${chord.map(noteName).join(' – ')} · channels 2–6` : 'Click a five-note chord to select it for touch control.'}{enabled && !output && ' Choose a MIDI output above.'}</p>
    <div className="five-voice-columns">
      {columns.map((column, index) => <div key={index} className={column.touched ? 'touched' : ''}>
        <span>Column {index + 1}</span>
        <meter min={0} max={1} value={column.value} aria-label={`Column ${index + 1} vertical position`} />
        <span>{column.touched ? 'Touched' : 'Released'} · {column.value.toFixed(2)}</span>
      </div>)}
    </div>
  </section>
}
