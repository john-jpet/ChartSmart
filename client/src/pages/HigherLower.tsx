import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, CalendarDays, Disc3, Mic2, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { getHigherLowerPairs } from '../lib/api'
import type { HigherLowerPair } from '../lib/api'
import VinylBadge from '../components/VinylBadge'

type Mode = 'artists' | 'tracks'

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function HigherLower() {
  const [mode, setMode] = useState<Mode>('artists')
  const [daily, setDaily] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [pairs, setPairs] = useState<HigherLowerPair[] | null>(null)
  const [round, setRound] = useState(0)
  const [streak, setStreak] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function startGame(nextMode = mode, nextDaily = daily) {
    setLoading(true)
    setError(null)
    try {
      const data = await getHigherLowerPairs({ mode: nextMode, daily: nextDaily, count: 10 })
      setPairs(data.pairs)
      setRound(0)
      setStreak(0)
      setRevealed(false)
      setLastCorrect(null)
      setGameOver(false)
      setGameStarted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load round')
    } finally {
      setLoading(false)
    }
  }

  const pair = pairs?.[round]

  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (!gameStarted || !soundOn || !pair) return
    const previewUrl = pair.b.previewUrl ?? pair.a.previewUrl
    if (!previewUrl) return
    const audio = new Audio(previewUrl)
    audio.loop = true
    audio.volume = 0.45
    audioRef.current = audio
    audio.play().catch(() => {})
    return () => audio.pause()
  }, [gameStarted, pair, soundOn])

  function guess(direction: 'higher' | 'lower') {
    if (!pairs || revealed) return
    const pair = pairs[round]
    const isHigher = pair.b.playcount >= pair.a.playcount
    const correct = direction === 'higher' ? isHigher : !isHigher
    setRevealed(true)
    setLastCorrect(correct)
    if (correct) {
      setStreak((s) => s + 1)
    } else {
      setGameOver(true)
    }
  }

  function next() {
    if (!pairs) return
    if (round + 1 >= pairs.length) {
      setGameOver(true)
      return
    }
    setRound((r) => r + 1)
    setRevealed(false)
    setLastCorrect(null)
  }

  function returnToChallengeMenu() {
    audioRef.current?.pause()
    audioRef.current = null
    setGameStarted(false)
    setPairs(null)
    setRound(0)
    setStreak(0)
    setRevealed(false)
    setLastCorrect(null)
    setGameOver(false)
    setError(null)
  }

  return (
    <div className="game-page game-page-pink flex-1 flex flex-col items-center gap-8 px-4 sm:px-8 py-10 sm:py-14">
      <div className="text-center space-y-4 animate-pop-in">
        <span className="eyebrow"><Sparkles className="w-4 h-4" /> Turn it up, trust your gut</span>
        <h1 className="game-title">Higher or <span className="text-pink">Lower!</span></h1>
        <p className="max-w-xl font-bold">Hear the contender, then guess which playcount wins.</p>
      </div>

      {!gameStarted && (
        <section className="brutal-panel candy-panel w-full max-w-2xl p-5 sm:p-8 flex flex-col gap-6 animate-bounce-in">
          <div>
            <p className="font-display uppercase text-2xl">Choose your challenge</p>
            <p className="font-mono-chart text-sm mt-1">Your selection starts the music.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button disabled={loading} onClick={() => { setMode('artists'); setDaily(false); startGame('artists', false) }} className="challenge-tile brutal-press bg-yellow">
              <Mic2 className="w-8 h-8" /><strong>Artists</strong><span>Compare stars</span>
            </button>
            <button disabled={loading} onClick={() => { setMode('tracks'); setDaily(false); startGame('tracks', false) }} className="challenge-tile brutal-press bg-cyan">
              <Disc3 className="w-8 h-8" /><strong>Songs</strong><span>Compare hits</span>
            </button>
            <button disabled={loading} onClick={() => { setMode('tracks'); setDaily(true); startGame('tracks', true) }} className="challenge-tile brutal-press bg-pink">
              <CalendarDays className="w-8 h-8" /><strong>Daily</strong><span>Same for everyone</span>
            </button>
          </div>
          {loading && <p className="font-mono-chart text-sm text-center">Cueing up the records…</p>}
          {error && <p className="error-bubble">{error}</p>}
        </section>
      )}

      {gameStarted && <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="score-badge">STREAK {streak}</div>
        <div className="score-badge bg-cyan">{daily ? 'DAILY SONGS' : mode === 'artists' ? 'ARTISTS' : 'SONGS'}</div>
        <button onClick={() => setSoundOn((value) => !value)} className="sound-toggle brutal-press" aria-label={soundOn ? 'Mute music' : 'Play music'}>
          {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />} {soundOn ? 'Sound on' : 'Muted'}
        </button>
      </div>}

      {gameStarted && loading && <p className="font-mono-chart text-sm">loading round…</p>}
      {gameStarted && error && <p className="error-bubble">{error}</p>}

      {!loading && pair && (
        <div className="flex flex-col sm:flex-row items-stretch gap-6 sm:gap-4 w-full max-w-2xl">
          <div className="flex-1 brutal-panel p-6 flex flex-col items-center gap-2">
            {pair.a.artworkUrl && (
              <img
                src={pair.a.artworkUrl}
                alt=""
                className="w-28 h-28 sm:w-32 sm:h-32 object-cover border-[3px] border-ink"
              />
            )}
            {pair.a.subtitle && <p className="font-mono-chart text-xs uppercase opacity-60">{pair.a.subtitle}</p>}
            <p className="font-display uppercase text-lg text-center leading-tight">{pair.a.name}</p>
            <p className="font-mono-chart font-bold text-3xl sm:text-4xl text-ink">{formatCount(pair.a.playcount)}</p>
            <p className="font-mono-chart text-xs uppercase opacity-60">plays</p>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 sm:w-44">
            <VinylBadge size={56} label="VS" className="shrink-0" />
            {!revealed ? (
              <>
                <button
                  onClick={() => guess('higher')}
                  className="brutal-btn flex items-center justify-center gap-2"
                >
                  <ArrowUp className="w-4 h-4" /> Higher
                </button>
                <button
                  onClick={() => guess('lower')}
                  className="brutal-btn flex items-center justify-center gap-2"
                >
                  <ArrowDown className="w-4 h-4" /> Lower
                </button>
              </>
            ) : (
              <button
                onClick={gameOver ? () => startGame() : next}
                className="brutal-btn brutal-btn-accent flex items-center justify-center gap-2"
              >
                {gameOver ? (
                  <>
                  <RotateCcw className="w-4 h-4" /> Play again
                  </>
                ) : (
                  'Next'
                )}
              </button>
            )}
          </div>

          <div className="flex-1 brutal-panel p-6 flex flex-col items-center gap-2">
            {pair.b.artworkUrl && (
              <img
                src={pair.b.artworkUrl}
                alt=""
                className="w-28 h-28 sm:w-32 sm:h-32 object-cover border-[3px] border-ink"
              />
            )}
            {pair.b.subtitle && <p className="font-mono-chart text-xs uppercase opacity-60">{pair.b.subtitle}</p>}
            <p className="font-display uppercase text-lg text-center leading-tight">{pair.b.name}</p>
            <p className="font-mono-chart font-bold text-3xl sm:text-4xl text-ink">
              {revealed ? formatCount(pair.b.playcount) : '???'}
            </p>
            <p className="font-mono-chart text-xs uppercase opacity-60">plays</p>
          </div>
        </div>
      )}

      {gameStarted && revealed && (
        <p className={`font-display uppercase text-xl ${lastCorrect ? 'text-good' : 'text-bad'}`}>
          {lastCorrect ? 'Correct!' : 'Wrong — game over.'}
        </p>
      )}
      {gameStarted && gameOver && lastCorrect && (
        <p className="font-mono-chart text-sm text-center">You cleared the whole chain! Final streak: {streak}</p>
      )}
      {gameStarted && <button onClick={returnToChallengeMenu} className="brutal-chip brutal-press bg-white">← Change challenge</button>}
      {gameStarted && <p className="font-mono-chart text-xs font-bold uppercase opacity-60">Play counts provided by Last.fm</p>}
    </div>
  )
}

export default HigherLower
