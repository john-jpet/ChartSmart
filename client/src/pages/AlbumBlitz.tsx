import { useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { Disc3, Shuffle, Sparkles, Timer } from 'lucide-react'
import { CATEGORIES, getAlbumBlitzRound } from '../lib/api'
import type { AlbumSummary, Category, Track } from '../lib/api'
import { buildMatchIndex, findMatch } from '../lib/fuzzyMatch'
import type { MatchableTrack } from '../lib/fuzzyMatch'

const ROUND_SECONDS = 60
type Stage = 'menu' | 'playing' | 'finished'

function AlbumBlitz() {
  const [stage, setStage] = useState<Stage>('menu')
  const [category, setCategory] = useState<Category>('general')
  const [album, setAlbum] = useState<AlbumSummary | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [found, setFound] = useState<Set<string>>(new Set())
  const [guess, setGuess] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const matchIndex = useMemo(() => tracks.length
    ? buildMatchIndex(tracks.map((track) => ({ id: track.id, title: track.title })))
    : null, [tracks])

  useEffect(() => {
    if (stage !== 'playing') return
    if (secondsLeft <= 0) {
      setStage('finished')
      return
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [stage, secondsLeft])

  async function startGame() {
    setLoading(true)
    setError(null)
    try {
      const data = await getAlbumBlitzRound(category)
      setAlbum(data.album)
      setTracks(data.tracks)
      setFound(new Set())
      setGuess('')
      setSecondsLeft(ROUND_SECONDS)
      setStage('playing')
      setTimeout(() => inputRef.current?.focus(), 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find an album. Try again!')
    } finally {
      setLoading(false)
    }
  }

  function submitGuess(event: React.FormEvent) {
    event.preventDefault()
    if (!matchIndex || !guess.trim()) return
    const match: MatchableTrack | null = findMatch(matchIndex.fuse as Fuse<MatchableTrack>, guess)
    if (match) {
      const matchingIds = matchIndex.items
        .filter((track) => track.normalized === match.normalized)
        .map((track) => track.id)
      setFound((current) => {
        const next = new Set(current)
        matchingIds.forEach((id) => next.add(id))
        return next
      })
    }
    setGuess('')
  }

  return (
    <div className="game-page game-page-yellow flex-1 px-4 sm:px-8 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-4xl flex flex-col items-center gap-7">
        <div className="text-center space-y-4 animate-pop-in">
          <span className="eyebrow"><Sparkles className="w-4 h-4" /> 60-second track attack</span>
          <h1 className="game-title">Album <span className="text-pink">Blitz!</span></h1>
          <p className="max-w-xl font-bold">Pick an era. We pick the album. You name as many tracks as you can.</p>
        </div>

        {stage === 'menu' && (
          <section className="brutal-panel candy-panel w-full max-w-2xl p-5 sm:p-8 flex flex-col gap-6 animate-bounce-in">
            <div>
              <p className="font-display uppercase text-2xl">Choose your era</p>
              <p className="font-mono-chart text-sm mt-1">General mixes every decade.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((item, index) => (
                <button key={item.id} onClick={() => setCategory(item.id)}
                  className={`category-tile brutal-press ${category === item.id ? 'is-selected' : ''}`}
                  style={{ '--tile-delay': `${index * 35}ms` } as React.CSSProperties}>
                  {item.label}
                </button>
              ))}
            </div>
            <button onClick={startGame} disabled={loading} className="brutal-btn brutal-btn-accent self-center flex items-center gap-2 text-base">
              <Shuffle className="w-5 h-5" /> {loading ? 'Digging through crates…' : 'Drop a random album'}
            </button>
            {error && <p className="error-bubble">{error}</p>}
          </section>
        )}

        {(stage === 'playing' || stage === 'finished') && album && (
          <div className="w-full flex flex-col gap-6 animate-pop-in">
            <section className="brutal-panel bg-white p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5 rotate-card">
              {album.artworkUrl ? <img src={album.artworkUrl} alt={`${album.title} cover`} className="album-cover" /> : <Disc3 className="w-32 h-32" />}
              <div className="flex-1 text-center sm:text-left">
                <p className="font-mono-chart uppercase font-bold text-sm">Your mystery pick</p>
                <h2 className="font-display uppercase text-3xl sm:text-4xl leading-none mt-1">{album.title}</h2>
                <p className="font-bold mt-2">{album.artistName} · {album.releaseYear}</p>
              </div>
              <div className="flex sm:flex-col gap-3">
                <div className="score-badge"><Timer className="w-5 h-5" /> {stage === 'playing' ? `${secondsLeft}s` : 'TIME!'}</div>
                <div className="score-badge bg-cyan">{found.size}/{tracks.length}</div>
              </div>
            </section>

            {stage === 'playing' && (
              <form onSubmit={submitGuess} className="flex gap-3 w-full">
                <input ref={inputRef} value={guess} onChange={(event) => setGuess(event.target.value)} placeholder="TYPE A TRACK TITLE…" className="game-input" />
                <button className="brutal-btn brutal-btn-accent">Guess!</button>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tracks.map((track, index) => {
                const visible = found.has(track.id) || stage === 'finished'
                return <div key={track.id} className={`track-card ${found.has(track.id) ? 'is-found' : ''}`}>
                  <span className="font-mono-chart opacity-60">{String(index + 1).padStart(2, '0')}</span>
                  <span>{visible ? track.title : '???'}</span>
                </div>
              })}
            </div>

            {stage === 'finished' && <button onClick={() => setStage('menu')} className="brutal-btn brutal-btn-accent self-center flex items-center gap-2"><Shuffle className="w-5 h-5" /> Spin again</button>}
          </div>
        )}
      </div>
    </div>
  )
}

export default AlbumBlitz
