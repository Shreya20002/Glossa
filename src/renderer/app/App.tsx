import { useEffect, useState } from 'react'

const FEATURES = [
  { name: 'Talk time', detail: 'How much of the session you spend speaking' },
  { name: 'Pace', detail: 'Words per minute, with a nudge when you rush' },
  { name: 'Filler words', detail: '"um", "uh", "you know"… counted live' },
  { name: 'Monologue alert', detail: 'A soft pulse after a minute without a pause' },
  { name: 'Report card', detail: 'Your progress since last time' },
] as const

export function App() {
  const [version, setVersion] = useState<string>()

  useEffect(() => {
    void window.glossa.getAppVersion().then(setVersion)
  }, [])

  return (
    <main className="home">
      <header>
        <h1 className="wordmark">Glossa</h1>
        <p className="tagline">An invisible speech coach just for you.</p>
      </header>

      <ul className="features">
        {FEATURES.map((feature) => (
          <li key={feature.name}>
            <span className="feature-name">{feature.name}</span>
            <span className="feature-detail">{feature.detail}</span>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button className="start" type="button" disabled>
          Start session
        </button>
        <p className="hint">Live coaching is coming soon.</p>
      </div>

      <footer>{version ? `v${version} · ` : ''}Offline. Nothing leaves this computer.</footer>
    </main>
  )
}
