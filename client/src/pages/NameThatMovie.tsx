import { useCallback, useEffect, useRef, useState } from 'react'
import { Clapperboard, ChevronLeft, ChevronRight, Crown, Film, Flame, Headphones, Radio, Users, Volume2, VolumeX } from 'lucide-react'
import { CATEGORIES, getNameThatMovieRounds } from '../lib/api'
import type { Category, NameThatMovieRound } from '../lib/api'
import { getSocket } from '../lib/socket'
import type { EndGamePayload, Player, RoundEndPayload, RoundStartPayload } from '../lib/socket'
import JoinQrCode from '../components/JoinQrCode'

const ROUND_MS = 10000
const RESULT_MS = 2500
const MIN_COUNT = 5
const MAX_COUNT = 50
const COUNT_STEP = 5
// TMDB backdrop/soundtrack coverage thins out before the 70s, so movie rounds stick to general or 1970s+.
const MOVIE_CATEGORIES = CATEGORIES.filter((item) => item.id === 'general' || Number(item.id.slice(0, 4)) >= 1970)
type Screen = 'menu' | 'lobby' | 'playing' | 'result' | 'end' | 'solo-playing' | 'solo-result' | 'solo-end'
type Mode = 'solo' | 'create' | 'join'

function Timer({ remaining }: { remaining: number }) {
  const pct = Math.max(0, Math.min(100, remaining / ROUND_MS * 100))
  return <div className="w-full flex items-center gap-3"><div className="flex-1 h-4 brutal-panel overflow-hidden"><div className="h-full bg-accent" style={{ width: `${pct}%`, transition: 'width 100ms linear' }} /></div><span className="font-mono-chart font-bold text-lg">{Math.ceil(remaining / 1000)}</span></div>
}

function Leaderboard({ players, scores, streaks = {}, self }: { players: Player[]; scores: Record<string, number>; streaks?: Record<string, number>; self?: string }) {
  return <div className="w-full flex flex-col gap-2.5">{[...players].sort((a, b) => (scores[b.id] ?? b.score) - (scores[a.id] ?? a.score)).map((player, index) => (
    <div key={player.id} className={`flex items-center justify-between brutal-panel px-4 py-2.5 ${player.id === self ? 'leaderboard-self' : ''}`}>
      <span className="flex items-center gap-2 font-bold"><span className="font-mono-chart text-xs opacity-60">{index + 1}</span>{player.name}{player.isHost && <Crown className="w-3.5 h-3.5 text-rose" />}</span>
      <span className="flex items-center gap-3">{(streaks[player.id] ?? player.streak) >= 2 && <span className="streak-badge"><Flame className="w-4 h-4" />{streaks[player.id] ?? player.streak}</span>}<b className="font-mono-chart text-lg">{scores[player.id] ?? player.score}</b></span>
    </div>
  ))}</div>
}

function Stepper({ value, onPrev, onNext, prevDisabled, nextDisabled }: { value: string; onPrev: () => void; onNext: () => void; prevDisabled?: boolean; nextDisabled?: boolean }) {
  return <div className="stepper-control brutal-panel bg-white flex items-center justify-between px-3 py-2.5"><button type="button" onClick={onPrev} disabled={prevDisabled} aria-label="Previous" className="stepper-arrow brutal-press"><ChevronLeft className="w-5 h-5" /></button><span className="font-display uppercase text-2xl">{value}</span><button type="button" onClick={onNext} disabled={nextDisabled} aria-label="Next" className="stepper-arrow brutal-press"><ChevronRight className="w-5 h-5" /></button></div>
}

function MovieFrame({ src }: { src: string }) {
  return <div className="movie-frame w-full aspect-video brutal-panel bg-ink overflow-hidden"><img src={src} alt="Mystery movie still" className="w-full h-full object-cover" /></div>
}

export default function NameThatMovie() {
  const socket = useRef(getSocket())
  const audio = useRef<HTMLAudioElement | null>(null)
  const roomRef = useRef<string | null>(null)
  const selectedRef = useRef<number | null>(null)
  const startedRef = useRef(0)
  const finalizeRef = useRef<() => void>(() => {})
  const joinFromUrl = new URLSearchParams(location.search).get('join')?.toUpperCase() || ''

  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<Mode>(joinFromUrl ? 'join' : 'solo')
  const [category, setCategory] = useState<Category>('general')
  const [count, setCount] = useState(5)
  const [remote, setRemote] = useState(false)
  const [name, setName] = useState('')
  const [codeInput, setCodeInput] = useState(joinFromUrl)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [host, setHost] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState<RoundStartPayload | null>(null)
  const [roundResult, setRoundResult] = useState<RoundEndPayload | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [final, setFinal] = useState<EndGamePayload | null>(null)
  const [rounds, setRounds] = useState<NameThatMovieRound[]>([])
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [now, setNow] = useState(Date.now())
  const [sound, setSound] = useState(true)
  roomRef.current = roomCode

  const playPreview = useCallback((url?: string) => {
    audio.current?.pause()
    if (!url || !sound) return
    const next = new Audio(url)
    next.volume = 0.45
    audio.current = next
    next.play().catch(() => {})
    setTimeout(() => next.pause(), ROUND_MS)
  }, [sound])

  useEffect(() => {
    const client = socket.current
    const created = ({ roomCode: code }: { roomCode: string }) => { setRoomCode(code); setHost(true); setLoading(false); setScreen('lobby') }
    const joined = ({ roomCode: code }: { roomCode: string }) => { setRoomCode(code); setHost(false); setLoading(false); setScreen('lobby') }
    const updated = ({ players: list }: { players: Player[] }) => setPlayers(list)
    const failed = ({ error: message }: { error: string }) => { setError(message); setLoading(false) }
    const cancelled = ({ error: message }: { error: string }) => { setError(message); setRoomCode(null); setScreen('menu') }
    const began = (payload: RoundStartPayload) => { setRound(payload); setSelected(null); setRoundResult(null); startedRef.current = Date.now(); setScreen('playing'); playPreview(payload.previewUrl) }
    const ended = (payload: RoundEndPayload) => { audio.current?.pause(); setRoundResult(payload); setScreen('result') }
    const gameEnded = (payload: EndGamePayload) => { setFinal(payload); setScreen('end') }
    client.on('room:created', created); client.on('room:joined', joined); client.on('room:updated', updated); client.on('room:error', failed); client.on('room:cancelled', cancelled); client.on('game:round_start', began); client.on('game:round_end', ended); client.on('game:end_game', gameEnded)
    return () => { client.off('room:created', created); client.off('room:joined', joined); client.off('room:updated', updated); client.off('room:error', failed); client.off('room:cancelled', cancelled); client.off('game:round_start', began); client.off('game:round_end', ended); client.off('game:end_game', gameEnded) }
  }, [playPreview])

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer) }, [])
  useEffect(() => () => { audio.current?.pause(); if (roomRef.current) socket.current.emit('room:leave') }, [])

  useEffect(() => {
    if (screen !== 'solo-playing') return
    const current = rounds[index]
    if (!current) return
    selectedRef.current = null; setSelected(null); startedRef.current = Date.now(); playPreview(current.previewUrl)
    let done = false
    const finalize = () => {
      if (done) return
      done = true; audio.current?.pause()
      const won = selectedRef.current === current.correctIndex
      if (won) setScore((value) => value + 100 + Math.round(Math.max(0, ROUND_MS - (Date.now() - startedRef.current)) / ROUND_MS * 900))
      setCorrect(won); setScreen('solo-result')
    }
    finalizeRef.current = finalize
    const timer = setTimeout(finalize, ROUND_MS)
    return () => clearTimeout(timer)
  }, [screen, index, rounds, playPreview])

  useEffect(() => {
    if (screen !== 'solo-result') return
    const timer = setTimeout(() => { if (index + 1 >= rounds.length) setScreen('solo-end'); else { setIndex((value) => value + 1); setScreen('solo-playing') } }, RESULT_MS)
    return () => clearTimeout(timer)
  }, [screen, index, rounds.length])

  function cycleCategory(direction: 1 | -1) {
    const idx = MOVIE_CATEGORIES.findIndex((item) => item.id === category)
    const next = (idx + direction + MOVIE_CATEGORIES.length) % MOVIE_CATEGORIES.length
    setCategory(MOVIE_CATEGORIES[next].id)
  }
  function stepCount(direction: 1 | -1) {
    setCount((value) => Math.min(MAX_COUNT, Math.max(MIN_COUNT, value + direction * COUNT_STEP)))
  }

  async function startSolo() {
    setLoading(true); setError(null)
    try { const data = await getNameThatMovieRounds(count, category); if (!data.rounds.length) throw new Error('No movie rounds are available.'); setRounds(data.rounds); setIndex(0); setScore(0); setScreen('solo-playing') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start the game.') }
    finally { setLoading(false) }
  }
  function createRoom() { setLoading(true); setError(null); socket.current.emit('room:create', { hostName: name || 'Host', settings: { totalRounds: count, category, playbackMode: remote ? 'remote' : 'party', gameType: 'movie' } }) }
  function joinRoom() { if (!codeInput.trim()) return setError('Enter a room code first.'); setLoading(true); socket.current.emit('room:join', { roomCode: codeInput.trim(), playerName: name || 'Player', gameType: 'movie' }) }
  function answer(option: number, solo = false) { if (selectedRef.current !== null) return; selectedRef.current = option; setSelected(option); if (solo) setTimeout(() => finalizeRef.current(), 450); else socket.current.emit('game:submit_answer', { roomCode, optionIndex: option }) }
  function reset() { if (roomRef.current) socket.current.emit('room:leave'); audio.current?.pause(); setScreen('menu'); setRoomCode(null); setPlayers([]); setRound(null); setFinal(null); setError(null); setSelected(null); selectedRef.current = null }
  const soloRound = rounds[index]
  const active = screen === 'solo-playing' || screen === 'solo-result' ? soloRound : round
  const remaining = Math.max(0, ROUND_MS - (now - startedRef.current))

  return <div className="game-page game-page-violet flex-1 flex flex-col items-center gap-8 px-4 sm:px-8 py-10 sm:py-14">
    <div className="text-center space-y-4 animate-pop-in"><span className="eyebrow"><Clapperboard className="w-4 h-4" /> Experimental cinema trivia</span><h1 className="game-title">Name That <span className="text-pink">Movie!</span></h1><p className="max-w-xl font-bold">Read the frame, hear the score, and identify the film.</p></div>

    {screen === 'menu' && <section className="brutal-panel candy-panel w-full max-w-2xl p-5 sm:p-8 flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">{([['solo', Headphones], ['create', Radio], ['join', Users]] as const).map(([value, Icon]) => <button key={value} onClick={() => setMode(value)} className={`mode-tile brutal-press ${mode === value ? 'is-selected' : ''}`}><Icon className="w-5 h-5" />{value === 'create' ? 'Host' : value[0].toUpperCase() + value.slice(1)}</button>)}</div>
      {mode !== 'join' && <><div><p className="font-display uppercase text-2xl">Choose an era</p><div className="mt-3"><Stepper value={MOVIE_CATEGORIES.find((item) => item.id === category)?.label ?? ''} onPrev={() => cycleCategory(-1)} onNext={() => cycleCategory(1)} /></div></div><div><p className="font-display uppercase text-2xl">Questions</p><div className="mt-3"><Stepper value={String(count)} onPrev={() => stepCount(-1)} onNext={() => stepCount(1)} prevDisabled={count <= MIN_COUNT} nextDisabled={count >= MAX_COUNT} /></div></div></>}
      {mode === 'create' && <div className="grid grid-cols-2 gap-3"><button onClick={() => setRemote(false)} className={`playback-mode-tile brutal-press ${!remote ? 'is-selected' : ''}`}><Users className="w-6 h-6" /><strong>Party</strong><span>Host audio</span></button><button onClick={() => setRemote(true)} className={`playback-mode-tile brutal-press ${remote ? 'is-selected' : ''}`}><Headphones className="w-6 h-6" /><strong>Remote</strong><span>Audio everywhere</span></button></div>}
      {(mode === 'join' || (mode === 'create' && remote)) && <input className="game-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === 'create' ? 'Host player name' : 'Your name'} />}{mode === 'join' && <input className="game-input uppercase" value={codeInput} onChange={(event) => setCodeInput(event.target.value)} placeholder="Room code" />}
      <button disabled={loading} onClick={mode === 'solo' ? startSolo : mode === 'create' ? createRoom : joinRoom} className="brutal-btn brutal-btn-accent self-center min-w-44">{loading ? 'Loading…' : mode === 'solo' ? 'Play solo' : mode === 'create' ? 'Create' : 'Join'}</button>{error && <p className="error-bubble">{error}{error.includes('TMDB') && ' Add it to the root .env file, then restart the server.'}</p>}
    </section>}

    {screen === 'lobby' && <div className="w-full max-w-sm flex flex-col items-center gap-5"><div className="ticket-stub px-6 py-3 text-3xl tracking-[0.3em]">{roomCode}</div>{host && roomCode && <><JoinQrCode value={`${location.origin}${import.meta.env.BASE_URL}name-that-movie?join=${roomCode}`} /><p className="font-mono-chart text-xs opacity-60">Scan to join</p></>}<Leaderboard players={players} scores={{}} self={socket.current.id} />{host ? <button onClick={() => socket.current.emit('room:start', { roomCode })} disabled={players.length < 1} className="brutal-btn brutal-btn-accent">Start game</button> : <p className="font-mono-chart text-sm">Waiting for the host…</p>}</div>}

    {(screen === 'playing' || screen === 'solo-playing') && active && <div className="w-full max-w-2xl flex flex-col items-center gap-5"><div className="flex items-center gap-3"><span className="brutal-stub px-4 py-1.5">ROUND {screen === 'solo-playing' ? index + 1 : round?.round} / {screen === 'solo-playing' ? rounds.length : round?.totalRounds}</span>{screen === 'solo-playing' && <span className="brutal-stub px-4 py-1.5">SCORE {score}</span>}<button className="sound-toggle brutal-press" onClick={() => { setSound((value) => !value); audio.current?.pause() }}>{sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button></div><Timer remaining={remaining} />{'imageUrl' in active && active.imageUrl && <MovieFrame src={active.imageUrl} />}{host && !remote && screen === 'playing' ? <div className="party-host-display brutal-panel w-full p-5 text-center"><Film className="w-8 h-8 mx-auto" /><p className="font-display uppercase text-2xl">Players answer on their devices</p></div> : <div className="w-full grid sm:grid-cols-2 gap-3">{active.options.map((option, optionIndex) => <button key={option} disabled={selected !== null} onClick={() => answer(optionIndex, screen === 'solo-playing')} className={`brutal-btn answer-option text-left ${selected === optionIndex ? 'brutal-btn-accent' : ''}`}>{option}</button>)}</div>}</div>}

    {(screen === 'result' || screen === 'solo-result') && active && <div className="w-full max-w-md flex flex-col items-center gap-5">
      {'imageUrl' in active && active.imageUrl && <MovieFrame src={active.imageUrl} />}
      {screen === 'solo-result' ? <>
        <p className={`font-display uppercase text-2xl ${correct ? 'text-good' : 'text-bad'}`}>{correct ? 'Correct!' : 'Wrong'}</p>
        <div className="brutal-panel bg-white w-full p-5 text-center">
          <p className="font-mono-chart text-xs uppercase opacity-60">The movie was</p>
          <p className="font-display uppercase text-2xl text-good mt-1">{active.options[(active as NameThatMovieRound).correctIndex]}</p>
        </div>
        <span className="brutal-stub px-4 py-2">SCORE {score}</span>
      </> : roundResult && <>
        <div className="brutal-panel bg-white w-full p-5 text-center">
          <p className="font-mono-chart text-xs uppercase opacity-60">Correct movie</p>
          <p className="font-display uppercase text-2xl text-good mt-1">{active.options[roundResult.correctAnswerIndex]}</p>
        </div>
        <div className="w-full">
          <p className="font-display uppercase text-2xl mb-3">Leaderboard</p>
          <Leaderboard players={players} scores={roundResult.scores} streaks={roundResult.streaks} self={socket.current.id} />
        </div>
      </>}
    </div>}

    {(screen === 'end' || screen === 'solo-end') && <div className="w-full max-w-sm flex flex-col items-center gap-5"><h2 className="font-display uppercase text-3xl">Final score</h2>{screen === 'solo-end' ? <span className="brutal-stub px-6 py-3 text-3xl">{score}</span> : final && <Leaderboard players={final.players} scores={final.scores} self={socket.current.id} />}<button onClick={reset} className="brutal-btn brutal-btn-accent">Play again</button></div>}
  </div>
}
