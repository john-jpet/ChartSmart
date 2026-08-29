import { Link } from 'react-router-dom'
import { TrendingUp, ListChecks, Users, ArrowRight, Clapperboard } from 'lucide-react'
import VinylBadge from '../components/VinylBadge'

const MODES = [
  {
    to: '/name-that-tune',
    icon: Users,
    title: 'Name That Tune',
    description: 'Race friends in a live room to identify songs from short audio snippets.',
    players: '2+ players',
  },
  {
    to: '/name-that-movie',
    icon: Clapperboard,
    title: 'Name That Movie',
    description: 'Identify movies from cinematic stills, backed by a cue from the original soundtrack when available.',
    players: '2+ players',
  },
  {
    to: '/higher-lower',
    icon: TrendingUp,
    title: 'Higher or Lower',
    description: 'Guess which artist or song has more plays. One miss ends the streak.',
    players: '1 player',
  },
  {
    to: '/album-blitz',
    icon: ListChecks,
    title: 'Album Blitz',
    description: 'Pick a decade, get a surprise album, and name its tracks before time runs out.',
    players: '1 player',
  },
]

function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <section className="hero-stage relative border-b-[3px] border-ink px-4 sm:px-8 py-16 sm:py-24 flex flex-col gap-6 overflow-hidden">
        <VinylBadge
          size={220}
          spinning
          className="animate-floaty hidden lg:block absolute right-12 top-1/3 opacity-90"
        />
        <p className="hero-kicker">
          &gt; live music-data trivia_
        </p>
        <h1 className="hero-title font-display uppercase leading-[0.85] text-[18vw] sm:text-[11vw] lg:text-[8.5rem] relative z-10 animate-pop-in">
          Chart
          <span className="text-rose" style={{ WebkitTextStroke: '2px var(--color-ink)' }}>
            Smart
          </span>
        </h1>
        <p className="font-body text-base sm:text-lg max-w-xl relative z-10">
          Real playcounts. Real audio. Big bragging rights. Pick a game and make some noise! <span aria-hidden>♪</span>
        </p>
      </section>

      <section className="flex-1 flex flex-col">
        {MODES.map((mode) => (
          <Link
            key={mode.to}
            to={mode.to}
            className="mode-row group border-b-[3px] border-ink px-4 sm:px-8 py-8 sm:py-10 flex items-center gap-6 transition-all"
          >
            <mode.icon className="mode-icon w-12 h-12 sm:w-14 sm:h-14 shrink-0" strokeWidth={2.5} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">
                  <span aria-hidden className="text-rose" style={{ WebkitTextStroke: '1.5px var(--color-ink)' }}>
                    ♪{' '}
                  </span>
                  {mode.title}
                </h2>
                <span className="font-mono-chart text-xs uppercase opacity-70">{mode.players}</span>
              </div>
              <p className="mt-1 text-sm sm:text-base opacity-80 max-w-xl">{mode.description}</p>
            </div>
            <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 transition-transform group-hover:translate-x-2" />
          </Link>
        ))}
      </section>
    </div>
  )
}

export default Home
