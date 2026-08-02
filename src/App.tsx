import { useEffect, useState, type ReactNode } from 'react'
import { nextInitiativeRoller } from '@shared/game/initiative.ts'
import type { PlayerId } from '@shared/game/types.ts'
import { Board } from './components/Board'
import { Dice } from './components/Dice'
import { GameOverModal } from './components/GameOverModal'
import { GameStatus } from './components/GameStatus'
import { InitiativeScreen } from './components/InitiativeScreen'
import { LobbyScreen } from './components/LobbyScreen'
import { NameGate } from './components/NameGate'
import { PlayerList } from './components/PlayerList'
import { StartScreen, type LocalStartConfig } from './components/StartScreen'
import { useGame } from './hooks/useGame'
import { useOnlineGame } from './hooks/useOnlineGame'
import {
  loadPlayerName,
  loadSoundEnabled,
  savePlayerName,
  saveSoundEnabled,
} from './lib/playerProfile.ts'
import { playClick, setSoundEnabled, unlockAudio } from './lib/sounds.ts'
import './styles/global.css'

type PlayMode = 'menu' | 'local' | 'online'

function App() {
  const [playerName, setPlayerName] = useState(() => loadPlayerName())
  const [naming, setNaming] = useState(() => loadPlayerName().length < 2)
  const [soundOn, setSoundOn] = useState(() => loadSoundEnabled())
  const [playMode, setPlayMode] = useState<PlayMode>('menu')
  const local = useGame()
  const online = useOnlineGame()

  useEffect(() => {
    setSoundEnabled(soundOn)
    saveSoundEnabled(soundOn)
  }, [soundOn])

  useEffect(() => {
    const unlock = () => {
      void unlockAudio()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  const inOnlineSession =
    online.status === 'lobby' ||
    online.status === 'initiative' ||
    online.status === 'countdown' ||
    online.status === 'playing' ||
    online.status === 'finished'

  const effectiveMode: PlayMode =
    playMode === 'local'
      ? 'local'
      : inOnlineSession || playMode === 'online'
        ? 'online'
        : 'menu'

  if (naming) {
    return (
      <NameGate
        initialName={playerName}
        onConfirm={(name) => {
          void unlockAudio()
          playClick()
          savePlayerName(name)
          setPlayerName(name)
          setNaming(false)
        }}
      />
    )
  }

  const soundToggle = (
    <button
      type="button"
      className="btn btn--ghost btn--icon"
      aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
      title={soundOn ? 'Звук вкл.' : 'Звук выкл.'}
      onClick={() => {
        void unlockAudio()
        setSoundOn((v) => !v)
      }}
    >
      {soundOn ? '♪' : '✕♪'}
    </button>
  )

  if (
    effectiveMode === 'menu' ||
    (effectiveMode === 'online' &&
      (online.status === 'idle' ||
        online.status === 'connecting' ||
        online.status === 'error') &&
      !inOnlineSession)
  ) {
    return (
      <>
        <div className="app-chrome">{soundToggle}</div>
        <StartScreen
          playerName={playerName}
          onChangeName={() => setNaming(true)}
          onStartLocal={(config: LocalStartConfig) => {
            void unlockAudio()
            playClick()
            setPlayMode('local')
            local.startGame(config.playersCount, config.colors, {
              botDifficulty: config.botDifficulty,
              names: { 1: config.playerName },
            })
          }}
          onCreateOnline={(count) => {
            void unlockAudio()
            playClick()
            setPlayMode('online')
            online.createRoom(count, playerName)
          }}
          onJoinOnline={(code) => {
            void unlockAudio()
            playClick()
            setPlayMode('online')
            online.joinRoom(code, playerName)
          }}
          onlineError={online.error}
          onlineBusy={online.status === 'connecting'}
        />
      </>
    )
  }

  if (
    effectiveMode === 'online' &&
    online.status === 'lobby' &&
    online.room &&
    online.playerId
  ) {
    return (
      <LobbyScreen
        room={online.room}
        playerId={online.playerId}
        isHost={online.isHost}
        error={online.error}
        onStart={() => {
          void unlockAudio()
          playClick()
          online.startGame()
        }}
        onSetColor={online.setColor}
        onSetName={(name) => {
          savePlayerName(name)
          setPlayerName(name)
          online.setName(name)
        }}
        onLeave={() => {
          online.leaveRoom()
          setPlayMode('menu')
        }}
        soundToggle={soundToggle}
      />
    )
  }

  if (
    effectiveMode === 'online' &&
    (online.status === 'initiative' || online.status === 'countdown') &&
    online.room?.initiative &&
    online.game
  ) {
    return (
      <InitiativeScreen
        players={online.game.players}
        initiative={online.room.initiative}
        canRoll={online.canRollInitiative && online.status === 'initiative'}
        isRolling={online.isRolling}
        shownDice={online.shownDice}
        onRoll={() => {
          void unlockAudio()
          playClick()
          online.rollInitiative()
        }}
        onLeave={() => {
          online.leaveRoom()
          setPlayMode('menu')
        }}
        modeLabel={`Онлайн · ${online.room.code}`}
        headerExtra={soundToggle}
      />
    )
  }

  if (
    effectiveMode === 'local' &&
    (local.state.phase === 'initiative' || local.state.phase === 'countdown') &&
    local.state.initiative
  ) {
    const roller = nextInitiativeRoller(local.state.initiative)
    return (
      <InitiativeScreen
        players={local.state.players}
        initiative={local.state.initiative}
        canRoll={
          local.state.phase === 'initiative' &&
          roller !== null &&
          !local.isRolling &&
          !local.paceLocked &&
          !(local.botConfig && local.botConfig.botIds.includes(roller))
        }
        isRolling={local.isRolling}
        shownDice={local.shownDice}
        onRoll={() => {
          void unlockAudio()
          playClick()
          local.rollInitiative()
        }}
        onLeave={() => {
          local.newGame()
          setPlayMode('menu')
        }}
        modeLabel="Локальная игра"
        headerExtra={soundToggle}
      />
    )
  }

  if (effectiveMode === 'local') {
    return (
      <LocalGameView
        local={local}
        soundToggle={soundToggle}
        onExit={() => {
          local.newGame()
          setPlayMode('menu')
        }}
      />
    )
  }

  if (
    effectiveMode === 'online' &&
    online.game &&
    online.playerId &&
    (online.status === 'playing' || online.status === 'finished')
  ) {
    return (
      <OnlineGameView
        online={online}
        soundToggle={soundToggle}
        onExitToMenu={() => {
          online.leaveRoom()
          setPlayMode('menu')
        }}
      />
    )
  }

  return (
    <>
      <div className="app-chrome">{soundToggle}</div>
      <StartScreen
        playerName={playerName}
        onChangeName={() => setNaming(true)}
        onStartLocal={(config: LocalStartConfig) => {
          void unlockAudio()
          playClick()
          setPlayMode('local')
          local.startGame(config.playersCount, config.colors, {
            botDifficulty: config.botDifficulty,
            names: { 1: config.playerName },
          })
        }}
        onCreateOnline={(count) => {
          void unlockAudio()
          playClick()
          setPlayMode('online')
          online.createRoom(count, playerName)
        }}
        onJoinOnline={(code) => {
          void unlockAudio()
          playClick()
          setPlayMode('online')
          online.joinRoom(code, playerName)
        }}
        onlineError={online.error ?? 'Подключение…'}
        onlineBusy
      />
    </>
  )
}

type LocalGameViewProps = {
  local: ReturnType<typeof useGame>
  soundToggle: ReactNode
  onExit: () => void
}

function LocalGameView({ local, soundToggle, onExit }: LocalGameViewProps) {
  const { state, isRolling, shownDice, isBotTurn, botConfig, paceLocked, lastMove } =
    local
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId)
  const winner = state.winner
    ? state.players.find((p) => p.id === state.winner)
    : undefined
  const canRoll =
    state.phase === 'waitingForRoll' && !isRolling && !isBotTurn && !paceLocked
  const canSelect =
    state.phase === 'selectingCell' && !isRolling && !isBotTurn && !paceLocked
  const showTargets =
    state.phase === 'selectingCell' && !isRolling && !(paceLocked && !lastMove)

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">
            Dice Grid · локально
            {botConfig
              ? ` · vs компьютер (${
                  botConfig.difficulty === 'easy'
                    ? 'лёгкий'
                    : botConfig.difficulty === 'medium'
                      ? 'средний'
                      : 'сложный'
                })`
              : ''}
          </p>
          <h1 className="app__title">Игровое поле</h1>
        </div>
        <div className="app__header-actions">
          {soundToggle}
          <button type="button" className="btn btn--ghost" onClick={onExit}>
            Новая игра
          </button>
        </div>
      </header>

      <main className="app__layout">
        <section className="panel panel--side">
          <h2 className="panel__title">Игроки</h2>
          <PlayerList
            players={state.players}
            currentPlayerId={state.currentPlayerId}
          />
        </section>

        <section className="panel panel--board">
          <div className="board-toolbar">
            <GameStatus currentPlayer={currentPlayer} />
            <Dice dice={shownDice} isRolling={isRolling} />
            {state.phase === 'turnSkipped' ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={isBotTurn || paceLocked}
                onClick={() => {
                  void unlockAudio()
                  playClick()
                  local.completeSkip()
                }}
              >
                Завершить ход
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canRoll}
                onClick={() => {
                  void unlockAudio()
                  playClick()
                  local.roll()
                }}
              >
                Бросить кубики
              </button>
            )}
          </div>

          <Board
            board={state.board}
            players={state.players}
            availableActions={state.availableActions}
            winningCells={state.winningCells}
            showTargets={showTargets}
            interactive={canSelect}
            accentColor={currentPlayer?.color}
            lastMove={lastMove?.coordinate ?? null}
            onSelect={local.selectCell}
          />
        </section>
      </main>

      {state.phase === 'gameOver' && winner ? (
        <GameOverModal
          winner={winner}
          onPlayAgain={() => {
            const colors = Object.fromEntries(
              state.players.map((p) => [p.id, p.color]),
            ) as Partial<Record<PlayerId, string>>
            const names = Object.fromEntries(
              state.players.map((p) => [p.id, p.name]),
            ) as Partial<Record<PlayerId, string>>
            local.startGame(state.playersCount, colors, {
              botDifficulty: botConfig?.difficulty,
              names,
            })
          }}
          onExitToMenu={onExit}
        />
      ) : null}
    </div>
  )
}

type OnlineGameViewProps = {
  online: ReturnType<typeof useOnlineGame>
  soundToggle: ReactNode
  onExitToMenu: () => void
}

function OnlineGameView({ online, soundToggle, onExitToMenu }: OnlineGameViewProps) {
  const game = online.game!
  const currentPlayer = game.players.find((p) => p.id === game.currentPlayerId)
  const winner = game.winner
    ? game.players.find((p) => p.id === game.winner)
    : undefined
  const myName =
    game.players.find((p) => p.id === online.playerId)?.name ??
    (online.playerId ? `Игрок ${online.playerId}` : '')

  const canRoll =
    online.isMyTurn &&
    game.phase === 'waitingForRoll' &&
    !online.isRolling &&
    !online.paceLocked
  const canSelect =
    online.isMyTurn &&
    game.phase === 'selectingCell' &&
    !online.isRolling &&
    !online.paceLocked
  const canSkip =
    online.isMyTurn &&
    game.phase === 'turnSkipped' &&
    !online.isRolling &&
    !online.paceLocked
  const showTargets =
    game.phase === 'selectingCell' &&
    !online.isRolling &&
    !(online.paceLocked && !online.lastMove)

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">
            Dice Grid · онлайн · код {online.room?.code}
            {myName ? ` · вы: ${myName}` : ''}
          </p>
          <h1 className="app__title">Игровое поле</h1>
        </div>
        <div className="app__header-actions">
          {soundToggle}
          {online.isHost ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={online.returnToLobby}
            >
              В лобби
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={onExitToMenu}>
            Выйти
          </button>
        </div>
      </header>

      {online.error ? (
        <p className="app__banner-error" role="alert">
          {online.error}
        </p>
      ) : null}

      <main className="app__layout">
        <section className="panel panel--side">
          <h2 className="panel__title">Игроки</h2>
          <PlayerList
            players={game.players}
            currentPlayerId={game.currentPlayerId}
          />
        </section>

        <section className="panel panel--board">
          <div className="board-toolbar">
            <GameStatus currentPlayer={currentPlayer} />

            {!online.isMyTurn && game.phase !== 'gameOver' ? (
              <p className="app__turn-hint">
                Сейчас ходит {currentPlayer?.name ?? 'другой игрок'}.
              </p>
            ) : null}

            <Dice dice={online.shownDice} isRolling={online.isRolling} />

            {game.phase === 'turnSkipped' ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canSkip}
                onClick={() => {
                  void unlockAudio()
                  playClick()
                  online.completeSkip()
                }}
              >
                Завершить ход
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canRoll}
                onClick={() => {
                  void unlockAudio()
                  playClick()
                  online.roll()
                }}
              >
                Бросить кубики
              </button>
            )}
          </div>

          <Board
            board={game.board}
            players={game.players}
            availableActions={game.availableActions}
            winningCells={game.winningCells}
            showTargets={showTargets}
            interactive={canSelect}
            accentColor={currentPlayer?.color}
            lastMove={online.lastMove?.coordinate ?? null}
            onSelect={online.selectCell}
          />
        </section>
      </main>

      {game.phase === 'gameOver' && winner ? (
        <GameOverModal
          winner={winner}
          showPlayAgain={online.isHost}
          onPlayAgain={online.isHost ? online.restartGame : undefined}
          playAgainLabel="Сыграть ещё раз"
          hint={
            online.isHost
              ? undefined
              : 'Новую партию может начать только хост комнаты.'
          }
          onExitToMenu={onExitToMenu}
        />
      ) : null}
    </div>
  )
}

export default App
