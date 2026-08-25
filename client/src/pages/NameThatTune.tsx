import { useEffect, useRef, useState } from 'react'
import { Crown, Flame, Headphones, Radio, Sparkles, Users, Volume2, VolumeX } from 'lucide-react'
import { getSocket } from '../lib/socket'
import type { Player, RoundStartPayload, RoundEndPayload, EndGamePayload } from '../lib/socket'
import { getNameThatTuneRounds, CATEGORIES } from '../lib/api'
import type { NameThatTuneRound, Category } from '../lib/api'
import VinylBadge from '../components/VinylBadge'
import JoinQrCode from '../components/JoinQrCode'

const SNIPPET_DURATION_MS = 8000
const DEFAULT_QUESTION_COUNT = 5
const QUESTION_COUNTS = [5, 10, 15, 20] as const
const SOLO_ANSWER_WINDOW_MS = 8000
const SOLO_RESULT_DISPLAY_MS = 2500
const SOLO_MIN_SCORE = 100
const SOLO_MAX_SCORE = 1000

type Screen = 'menu' | 'lobby' | 'playing' | 'round-result' | 'end' | 'solo-playing' | 'solo-result' | 'solo-end'
type Mode = 'solo' | 'create' | 'join'
type PlaybackMode = 'party' | 'remote'

function TimerBar({ remainingMs, durationMs }: { remainingMs: number; durationMs: number }) {
  const pct = Math.max(0, Math.min(100, (remainingMs / durationMs) * 100))
  const seconds = Math.ceil(remainingMs / 1000)
  return (
    <div className="w-full flex items-center gap-3">
      <div className="flex-1 h-4 brutal-panel overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%`, transition: 'width 100ms linear' }} />
      </div>
      <div className="font-mono-chart font-bold text-lg w-6 text-right">{seconds}</div>
    </div>
  )
}

function Leaderboard({ players, scores, streaks = {}, currentPlayerId }: { players: Player[]; scores: Record<string, number>; streaks?: Record<string, number>; currentPlayerId?: string }) {
  const sorted = [...players].sort((a, b) => (scores[b.id] ?? b.score) - (scores[a.id] ?? a.score))
  return (
    <div className="w-full flex flex-col gap-2.5">
      {sorted.map((p, i) => (
        <div key={p.id} className={`flex items-center justify-between brutal-panel px-4 py-2.5 ${p.id === currentPlayerId ? 'leaderboard-self' : ''}`}>
          <span className="flex items-center gap-2 font-bold">
            <span className="font-mono-chart text-xs opacity-60 w-4">{i + 1}</span>
            {p.name}
            {p.isHost && <Crown className="w-3.5 h-3.5 text-rose" fill="currentColor" />}
            {p.id === currentPlayerId && <span className="you-badge">YOU</span>}
          </span>
          <span className="flex items-center gap-3">
            {(streaks[p.id] ?? p.streak) >= 2 && <span className="streak-badge"><Flame className="w-4 h-4" />{streaks[p.id] ?? p.streak}</span>}
            <span className="font-mono-chart font-bold text-lg">{scores[p.id] ?? p.score}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function NameThatTune() {
  const socketRef = useRef(getSocket())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
  const roomCodeRef = useRef<string | null>(null)

  const joinCodeFromUrl = new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase() || ''

  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<Mode>(joinCodeFromUrl ? 'join' : 'solo')
  const [category, setCategory] = useState<Category>('general')
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT)
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('party')
  const [playerName, setPlayerName] = useState('')
  const [roomCodeInput, setRoomCodeInput] = useState(joinCodeFromUrl)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [lobbyTracks, setLobbyTracks] = useState<string[]>([])
  const [lobbyTrackIndex, setLobbyTrackIndex] = useState(0)
  const [lobbySoundOn, setLobbySoundOn] = useState(true)

  const [round, setRound] = useState<RoundStartPayload | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [roundResult, setRoundResult] = useState<RoundEndPayload | null>(null)
  const [finalScores, setFinalScores] = useState<Record<string, number>>({})
  const [finalPlayers, setFinalPlayers] = useState<Player[]>([])
  const roundStartClientTimeRef = useRef(0)

  const [soloRounds, setSoloRounds] = useState<NameThatTuneRound[]>([])
  const [soloIndex, setSoloIndex] = useState(0)
  const [soloScore, setSoloScore] = useState(0)
  const [soloSelected, setSoloSelected] = useState<number | null>(null)
  const [soloLastCorrect, setSoloLastCorrect] = useState<boolean | null>(null)
  const soloSelectedRef = useRef<number | null>(null)
  const soloStartTimeRef = useRef(0)
  const soloFinalizeRef = useRef<(() => void) | null>(null)

  const [now, setNow] = useState(() => Date.now())
  roomCodeRef.current = roomCode

  useEffect(() => {
    const socket = socketRef.current

    function onRoomCreated({ roomCode: code }: { roomCode: string }) {
      setLoading(false)
      setRoomCode(code)
      setIsHost(true)
      setScreen('lobby')
    }
    function onRoomJoined({ roomCode: code }: { roomCode: string }) {
      setLoading(false)
      setRoomCode(code)
      setIsHost(false)
      setScreen('lobby')
    }
    function onRoomUpdated({ players: list }: { players: Player[] }) {
      setPlayers(list)
    }
    function onRoomError({ code, error: msg }: { code?: string; error: string }) {
      setError(msg)
      setStarting(false)
      setLoading(false)
      if (code === 'INVALID_CODE' || code === 'ROOM_NOT_FOUND') {
        setRoomCode(null)
        setScreen('menu')
      }
    }
    function onRoomCancelled({ error: msg }: { error: string }) {
      audioRef.current?.pause()
      lobbyAudioRef.current?.pause()
      setError(msg)
      setRoomCode(null)
      setPlayers([])
      setIsHost(false)
      setStarting(false)
      setScreen('menu')
    }
    function onRoundStart(payload: RoundStartPayload) {
      setStarting(false)
      setRound(payload)
      setSelected(null)
      setRoundResult(null)
      roundStartClientTimeRef.current = Date.now()
      setScreen('playing')
    }
    function onRoundEnd(payload: RoundEndPayload) {
      setRoundResult(payload)
      setScreen('round-result')
    }
    function onEndGame(payload: EndGamePayload) {
      setFinalScores(payload.scores)
      setFinalPlayers(payload.players)
      setScreen('end')
    }

    socket.on('room:created', onRoomCreated)
    socket.on('room:joined', onRoomJoined)
    socket.on('room:updated', onRoomUpdated)
    socket.on('room:error', onRoomError)
    socket.on('room:cancelled', onRoomCancelled)
    socket.on('game:round_start', onRoundStart)
    socket.on('game:round_end', onRoundEnd)
    socket.on('game:end_game', onEndGame)

    return () => {
      socket.off('room:created', onRoomCreated)
      socket.off('room:joined', onRoomJoined)
      socket.off('room:updated', onRoomUpdated)
      socket.off('room:error', onRoomError)
      socket.off('room:cancelled', onRoomCancelled)
      socket.off('game:round_start', onRoundStart)
      socket.off('game:round_end', onRoundEnd)
      socket.off('game:end_game', onEndGame)
    }
  }, [])

  useEffect(() => {
    if (screen !== 'menu' || mode === 'join') return
    const timer = setTimeout(() => { void getNameThatTuneRounds(1, category).catch(() => {}) }, 250)
    return () => clearTimeout(timer)
  }, [screen, mode, category])

  useEffect(() => {
    if (!joinCodeFromUrl) return
    const url = new URL(window.location.href)
    url.searchParams.delete('join')
    window.history.replaceState({}, '', url)
  }, [])

  useEffect(() => () => {
    if (roomCodeRef.current) socketRef.current.emit('room:leave')
  }, [])

  useEffect(() => {
    lobbyAudioRef.current?.pause()
    lobbyAudioRef.current = null
    if (screen !== 'lobby' || !isHost || !lobbySoundOn || !lobbyTracks.length) return
    const audio = new Audio(lobbyTracks[lobbyTrackIndex % lobbyTracks.length])
    audio.volume = 0.35
    audio.onended = () => setLobbyTrackIndex((index) => (index + 1) % lobbyTracks.length)
    lobbyAudioRef.current = audio
    audio.play().catch(() => {})
    return () => {
      audio.onended = null
      audio.pause()
    }
  }, [screen, isHost, lobbySoundOn, lobbyTracks, lobbyTrackIndex])

  // Drives the visible countdown for both multiplayer and solo rounds.
  useEffect(() => {
    if (screen !== 'playing' && screen !== 'solo-playing') return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [screen])

  useEffect(() => {
    if (screen !== 'playing' || !round?.previewUrl) return
    const audio = new Audio(round.previewUrl)
    audioRef.current = audio
    audio.play().catch(() => {})
    const stopTimer = setTimeout(() => audio.pause(), SNIPPET_DURATION_MS)
    return () => {
      clearTimeout(stopTimer)
      audio.pause()
    }
  }, [screen, round])

  // Solo round machine: no server/room needed, so the client drives its own timer and scoring.
  useEffect(() => {
    if (screen !== 'solo-playing') return
    const soloRound = soloRounds[soloIndex]
    if (!soloRound) return

    soloSelectedRef.current = null
    setSoloSelected(null)
    soloStartTimeRef.current = Date.now()

    const audio = new Audio(soloRound.previewUrl)
    audioRef.current = audio
    audio.play().catch(() => {})
    const stopAudio = setTimeout(() => audio.pause(), SNIPPET_DURATION_MS)

    let resolved = false
    function finalize() {
      if (resolved) return
      resolved = true
      const selectedIndex = soloSelectedRef.current
      const correct = selectedIndex === soloRound.correctIndex
      let points = 0
      if (correct) {
        const elapsed = Date.now() - soloStartTimeRef.current
        const speedBonus = Math.max(0, SOLO_ANSWER_WINDOW_MS - elapsed)
        points = SOLO_MIN_SCORE + Math.round((speedBonus / SOLO_ANSWER_WINDOW_MS) * (SOLO_MAX_SCORE - SOLO_MIN_SCORE))
      }
      setSoloScore((s) => s + points)
      setSoloLastCorrect(correct)
      setScreen('solo-result')
    }
    soloFinalizeRef.current = finalize

    const endTimer = setTimeout(finalize, SOLO_ANSWER_WINDOW_MS)
    return () => {
      clearTimeout(stopAudio)
      clearTimeout(endTimer)
      audio.pause()
    }
  }, [screen, soloIndex, soloRounds])

  useEffect(() => {
    if (screen !== 'solo-result') return
    const timer = setTimeout(() => {
      if (soloIndex + 1 >= soloRounds.length) {
        setScreen('solo-end')
      } else {
        setSoloIndex((i) => i + 1)
        setScreen('solo-playing')
      }
    }, SOLO_RESULT_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [screen, soloIndex, soloRounds.length])

  async function startSolo() {
    setError(null)
    setLoading(true)
    try {
      const data = await getNameThatTuneRounds(questionCount, category)
      if (!data.rounds.length) {
        setError('No playable tracks available right now.')
        return
      }
      setSoloRounds(data.rounds)
      setSoloIndex(0)
      setSoloScore(0)
      setScreen('solo-playing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start solo round')
    } finally {
      setLoading(false)
    }
  }

  function selectSoloAnswer(optionIndex: number) {
    if (soloSelectedRef.current !== null) return
    soloSelectedRef.current = optionIndex
    setSoloSelected(optionIndex)
    setTimeout(() => soloFinalizeRef.current?.(), 500)
  }

  function createRoom() {
    setError(null)
    setLoading(true)
    setLobbyTracks([])
    setLobbyTrackIndex(0)
    void getNameThatTuneRounds(5, category)
      .then((data) => setLobbyTracks(data.rounds.map((item) => item.previewUrl)))
      .catch(() => {})
    socketRef.current.emit('room:create', {
      hostName: playerName || 'Host',
      settings: { totalRounds: questionCount, category, playbackMode },
    })
  }

  function joinRoom() {
    setError(null)
    const code = roomCodeInput.trim().toUpperCase()
    if (!code) {
      setError('Enter a room code first.')
      return
    }
    setLoading(true)
    socketRef.current.emit('room:join', { roomCode: code, playerName: playerName || 'Player' })
  }

  function startGame() {
    if (!roomCode || starting) return
    setStarting(true)
    socketRef.current.emit('room:start', { roomCode })
  }

  function submitAnswer(optionIndex: number) {
    if (selected !== null || !roomCode) return
    setSelected(optionIndex)
    socketRef.current.emit('game:submit_answer', { roomCode, optionIndex, clientTimeMs: Date.now() })
  }

  function playAgain() {
    if (roomCodeRef.current) socketRef.current.emit('room:leave')
    lobbyAudioRef.current?.pause()
    setScreen('menu')
    setRoomCode(null)
    setPlayers([])
    setIsHost(false)
    setRound(null)
    setRoundResult(null)
    setFinalScores({})
    setFinalPlayers([])
    setSoloRounds([])
    setSoloIndex(0)
    setSoloScore(0)
    setSoloSelected(null)
    setSoloLastCorrect(null)
    setStarting(false)
    setLobbyTracks([])
    setLobbyTrackIndex(0)
  }

  const soloRound = soloRounds[soloIndex]
  const roundRemainingMs = round ? Math.max(0, round.durationMs - (now - roundStartClientTimeRef.current)) : 0
  const soloRemainingMs = soloRound ? Math.max(0, SOLO_ANSWER_WINDOW_MS - (now - soloStartTimeRef.current)) : 0

  return (
    <div className="game-page game-page-cyan flex-1 flex flex-col items-center gap-8 px-4 sm:px-8 py-10 sm:py-14">
      <div className="text-center space-y-4 animate-pop-in">
        <span className="eyebrow"><Sparkles className="w-4 h-4" /> Audio trivia showdown</span>
        <h1 className="game-title">Name That <span className="text-pink">Tune!</span></h1>
        <p className="max-w-xl font-bold">Choose an era, listen closely, and race to recognize the hit.</p>
      </div>

      {screen === 'menu' && (
        <section className="brutal-panel candy-panel w-full max-w-2xl p-5 sm:p-8 flex flex-col gap-6 animate-bounce-in">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setMode('solo')}
              className={`mode-tile brutal-press ${mode === 'solo' ? 'is-selected' : ''}`}
            >
              <Headphones className="w-5 h-5" /> Solo
            </button>
            <button
              onClick={() => setMode('create')}
              className={`mode-tile brutal-press ${mode === 'create' ? 'is-selected' : ''}`}
            >
              <Radio className="w-5 h-5" /> Host
            </button>
            <button
              onClick={() => setMode('join')}
              className={`mode-tile brutal-press ${mode === 'join' ? 'is-selected' : ''}`}
            >
              <Users className="w-5 h-5" /> Join
            </button>
          </div>
          {mode !== 'join' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-display uppercase text-2xl">Choose your era</p>
                <p className="font-mono-chart text-sm mt-1">General shuffles the whole record rack.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CATEGORIES.map((c, index) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`category-tile brutal-press ${category === c.id ? 'is-selected' : ''}`}
                    style={{ '--tile-delay': `${index * 35}ms` } as React.CSSProperties}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div>
                <p className="font-display uppercase text-2xl">How many questions?</p>
                <div className="grid grid-cols-4 gap-3 mt-3">
                  {QUESTION_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`question-count-tile brutal-press ${questionCount === count ? 'is-selected' : ''}`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {mode === 'create' && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-display uppercase text-2xl">Where should audio play?</p>
                <p className="font-mono-chart text-sm mt-1">Party is best when everyone shares a room.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPlaybackMode('party')} className={`playback-mode-tile brutal-press ${playbackMode === 'party' ? 'is-selected' : ''}`}>
                  <Users className="w-6 h-6" /><strong>Party Mode</strong><span>Host device only</span>
                </button>
                <button onClick={() => setPlaybackMode('remote')} className={`playback-mode-tile brutal-press ${playbackMode === 'remote' ? 'is-selected' : ''}`}>
                  <Headphones className="w-6 h-6" /><strong>Remote Mode</strong><span>Every device</span>
                </button>
              </div>
            </div>
          )}
          {(mode === 'join' || (mode === 'create' && playbackMode === 'remote')) && (
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={mode === 'create' ? 'Host player name' : 'Your name'}
              className="game-input"
            />
          )}
          {mode === 'join' && (
            <input
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              placeholder="Room code"
              className="game-input uppercase"
            />
          )}
          <button
            onClick={mode === 'solo' ? startSolo : mode === 'create' ? createRoom : joinRoom}
            disabled={loading}
            className="brutal-btn brutal-btn-accent self-center min-w-44"
          >
            {loading ? 'Loading…' : mode === 'solo' ? 'Play solo' : mode === 'create' ? 'Create' : 'Join'}
          </button>
          {error && <p className="error-bubble">{error}</p>}
        </section>
      )}

      {screen === 'lobby' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          <p className="font-mono-chart text-xs uppercase opacity-60">Backstage pass</p>
          <div className="ticket-stub px-6 py-3 text-3xl tracking-[0.3em]">{roomCode}</div>
          {isHost && roomCode && (
            <div className="flex flex-col items-center gap-2">
              <JoinQrCode value={`${window.location.origin}${import.meta.env.BASE_URL}name-that-tune?join=${roomCode}`} />
              <p className="font-mono-chart text-xs opacity-60">Scan to join</p>
            </div>
          )}
          <div className="brutal-panel bg-white w-full p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b-[3px] border-ink pb-2">
              <p className="font-display uppercase text-2xl">Players joined</p>
              <span className="score-badge !min-w-0 !py-1 !px-2">{players.length}</span>
            </div>
            {players.length > 0 ? (
              <Leaderboard players={players} scores={{}} currentPlayerId={socketRef.current.id} />
            ) : (
              <p className="font-mono-chart text-sm text-center py-5 opacity-60">Waiting for players to enter the code…</p>
            )}
          </div>
          {isHost ? (
            <>
              <button onClick={() => setLobbySoundOn((value) => !value)} className="sound-toggle brutal-press">
                {lobbySoundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                {lobbySoundOn ? 'Lobby music on' : 'Lobby music off'}
              </button>
              <button onClick={startGame} disabled={players.length < 1 || starting} className="brutal-btn brutal-btn-accent px-8">
                {starting ? 'Loading round…' : 'Start game'}
              </button>
            </>
          ) : (
            <p className="font-mono-chart text-sm opacity-60">waiting for host to start…</p>
          )}
        </div>
      )}

      {screen === 'playing' && round && (
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <div className="brutal-stub px-4 py-1.5 text-sm">
            ROUND {round.round} / {round.totalRounds}
          </div>
          <TimerBar remainingMs={roundRemainingMs} durationMs={round.durationMs} />
          <VinylBadge size={72} spinning />
          {isHost && round.playbackMode === 'party' ? (
            <div className="party-host-display brutal-panel w-full p-6 text-center">
              <Radio className="w-9 h-9 mx-auto mb-3" />
              <p className="font-display uppercase text-3xl">Music is live!</p>
              <p className="font-mono-chart text-sm mt-2">Players answer on their devices</p>
            </div>
          ) : <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
            {round.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => submitAnswer(i)}
                disabled={selected !== null}
                className={`brutal-btn answer-option text-left ${selected === i ? 'brutal-btn-accent' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>}
          {!(isHost && round.playbackMode === 'party') && selected !== null && (
            <p className="font-mono-chart text-sm opacity-60">answer locked in — waiting for round to end…</p>
          )}
        </div>
      )}

      {screen === 'round-result' && roundResult && round && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          {round.artworkUrl && (
            <img src={round.artworkUrl} alt="" className="w-32 h-32 object-cover border-[3px] border-ink" />
          )}
          <p className="text-center">
            Correct answer:{' '}
            <span className="font-display uppercase text-good block text-xl mt-1">
              {round.options[roundResult.correctAnswerIndex]}
            </span>
          </p>
          <Leaderboard players={players} scores={roundResult.scores} streaks={roundResult.streaks} currentPlayerId={socketRef.current.id} />
        </div>
      )}

      {screen === 'end' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          <h2 className="font-display uppercase text-2xl">Final scores</h2>
          <Leaderboard players={finalPlayers} scores={finalScores} currentPlayerId={socketRef.current.id} />
          <button onClick={playAgain} className="brutal-btn brutal-btn-accent px-8">
            Play again
          </button>
        </div>
      )}

      {screen === 'solo-playing' && soloRound && (
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="brutal-stub px-4 py-1.5 text-sm">
              ROUND {soloIndex + 1} / {soloRounds.length}
            </div>
            <div className="brutal-stub px-4 py-1.5 text-sm">SCORE {soloScore}</div>
          </div>
          <TimerBar remainingMs={soloRemainingMs} durationMs={SOLO_ANSWER_WINDOW_MS} />
          <VinylBadge size={72} spinning />
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
            {soloRound.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => selectSoloAnswer(i)}
                disabled={soloSelected !== null}
                className={`brutal-btn answer-option text-left ${soloSelected === i ? 'brutal-btn-accent' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>
          {soloSelected !== null && <p className="font-mono-chart text-sm opacity-60">locked in…</p>}
        </div>
      )}

      {screen === 'solo-result' && soloRound && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          {soloRound.artworkUrl && (
            <img src={soloRound.artworkUrl} alt="" className="w-32 h-32 object-cover border-[3px] border-ink" />
          )}
          <p
            className={`font-display uppercase text-xl ${soloLastCorrect ? 'text-good' : 'text-bad'}`}
          >
            {soloLastCorrect ? 'Correct!' : 'Wrong'}
          </p>
          <p className="text-center">
            <span className="font-display uppercase text-lg block">{soloRound.options[soloRound.correctIndex]}</span>
          </p>
          <div className="brutal-stub px-4 py-1.5 text-sm">SCORE {soloScore}</div>
        </div>
      )}

      {screen === 'solo-end' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          <h2 className="font-display uppercase text-2xl">Final score</h2>
          <div className="brutal-stub px-6 py-3 text-3xl">{soloScore}</div>
          <button onClick={playAgain} className="brutal-btn brutal-btn-accent px-8">
            Play again
          </button>
        </div>
      )}
    </div>
  )
}

export default NameThatTune
