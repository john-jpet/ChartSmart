import { Link, Outlet, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/higher-lower', label: 'Higher/Lower' },
  { to: '/album-blitz', label: 'Album Blitz' },
  { to: '/name-that-tune', label: 'Name That Tune' },
]

function App() {
  const location = useLocation()

  return (
    <div className="app-shell min-h-screen text-ink flex flex-col font-body">
      <div className="h-2 hazard-bar" />
      <header className="site-header border-b-[3px] border-ink px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="logo-word font-display uppercase text-3xl tracking-tight leading-none">
          Chart<span className="text-rose" style={{ WebkitTextStroke: '1.5px var(--color-ink)' }}>Smart</span>
        </Link>
        <nav className="flex flex-wrap gap-2">
          {NAV_LINKS.map((link) => {
            const active = location.pathname.startsWith(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-pill brutal-chip brutal-press ${active ? 'is-active' : ''}`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}

export default App
