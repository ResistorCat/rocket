import { useState, useEffect } from 'react'
import type { HealthCheck, ApiResponse } from '@rocket/shared'
import './App.css'

function App() {
  const [health, setHealth] = useState<HealthCheck | null>(null)

  useEffect(() => {
    fetch('http://localhost:3001/health')
      .then(res => res.json())
      .then((data: ApiResponse<HealthCheck>) => {
        if (data.success && data.data) {
          setHealth({ status: data.data.status, timestamp: data.data.timestamp })
        }
      })
      .catch(err => console.error("Error fetching health", err))
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', background: '#111', color: '#eee', borderRadius: 8 }}>
      <h1>🚀 Rocket Web</h1>
      <p>Hello from Vite + React</p>
      
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#222', borderRadius: 4 }}>
        <h3>API Health Check</h3>
        {health ? (
          <div>
            <p>Status: <strong style={{ color: '#4ade80' }}>{health.status}</strong></p>
            <p>Timestamp: {new Date(health.timestamp).toLocaleTimeString()}</p>
          </div>
        ) : (
          <p style={{ color: '#f87171' }}>API is unreachable (is it running on port 3001?)</p>
        )}
      </div>
    </div>
  )
}

export default App
