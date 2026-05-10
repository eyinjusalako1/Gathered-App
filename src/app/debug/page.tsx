'use client'

import { useEffect, useState, useCallback } from 'react'

interface LogEntry {
  id: number
  ts: number
  source: 'SW' | 'NN' | string
  msg: string
  data: unknown
}

const DB_NAME = 'gathered-debug'
const STORE = 'logs'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

async function readLogs(): Promise<LogEntry[]> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      req.onsuccess = () => {
        const all = (req.result as LogEntry[])
        resolve(all.slice(-50).reverse())
      }
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

async function clearLogs(): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).clear()
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  } catch {}
}

const SOURCE_COLORS: Record<string, string> = {
  SW: '#f90',
  NN: '#0af',
}

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<string>('')

  const refresh = useCallback(async () => {
    const entries = await readLogs()
    setLogs(entries)
    setLoading(false)
    setLastRefresh(new Date().toISOString())
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleClear = async () => {
    await clearLogs()
    setLogs([])
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, padding: 16, background: '#0d0d0d', color: '#e0e0e0', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontWeight: 'bold', fontSize: 14 }}>Debug Log</span>
          <span style={{ color: '#555', marginLeft: 12 }}>
            <span style={{ color: SOURCE_COLORS.SW }}>■ SW</span>
            {' '}
            <span style={{ color: SOURCE_COLORS.NN }}>■ NN (NotificationNavigator)</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#555' }}>auto-refresh 2s · last: {lastRefresh.slice(11, 23)}</span>
          <button
            onClick={refresh}
            style={{ padding: '4px 10px', background: '#222', color: '#ccc', border: '1px solid #444', borderRadius: 4, cursor: 'pointer' }}
          >
            Refresh
          </button>
          <button
            onClick={handleClear}
            style={{ padding: '4px 10px', background: '#6b0000', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #222', paddingTop: 8 }}>
        {loading && <p style={{ color: '#555' }}>Loading…</p>}
        {!loading && logs.length === 0 && (
          <p style={{ color: '#555' }}>
            No logs yet. Trigger a notification tap, then return here.
          </p>
        )}
        {logs.map((entry) => (
          <div
            key={entry.id}
            style={{ borderBottom: '1px solid #1a1a1a', padding: '5px 0', lineHeight: 1.4 }}
          >
            <span style={{ color: '#555' }}>{new Date(entry.ts).toISOString().replace('T', ' ').slice(0, 23)} </span>
            <span style={{ color: SOURCE_COLORS[entry.source] ?? '#aaa', fontWeight: 'bold' }}>[{entry.source}] </span>
            <span>{entry.msg}</span>
            {entry.data !== null && entry.data !== undefined && (
              <pre style={{ margin: '2px 0 0 16px', color: '#888', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
