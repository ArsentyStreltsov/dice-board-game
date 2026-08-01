import { useState } from 'react'
import { nextInitiativeRoller } from '@shared/game/initiative.ts'
import type { PlayerId } from '@shared/game/types.ts'
import { ActionLog } from './components/ActionLog'
import { Board } from './components/Board'
import { DevPanel } from './components/DevPanel'
import { Dice } from './components/Dice'
import { GameOverModal } from './components/GameOverModal'
import { GameStatus } from './components/GameStatus'
import { InitiativeScreen } from './components/InitiativeScreen'
import { LobbyScreen } from './components/LobbyScreen'
import { PlayerList } from './components/PlayerList'
import { StartScreen } from './components/StartScreen'
import { useGame } from './hooks/useGame'
import { useOnlineGame } from './hooks/useOnlineGame'
import './styles/global.css'

type PlayMode = 'menu' | 'local' | 'online'

function App() {
  const [playMode, setPlayMode] = useState<PlayMode>('menu')
  const local = useGame()
  const online = useOnlineGame()
  const [devOpen, setDevOpen] = useState(false)

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

  if (
    effectiveMode === 'menu' ||
    (effectiveMode === 'online' &&
      (online.status === 'idle' ||
        online.status === 'connecting' ||
        online.status === 'error') &&
      !inOnlineSession)
  ) {
    return (
      <StartScreen
        onStartLocal={(count, colors) => {
          setPlayMode('local')
          local.startGame(count, colors)
        }}
        onCreateOnline={(count) => {
          setPlayMode('online')
          online.createRoom(count)
        }}
        onJoinOnline={(code) => {
          setPlayMode('online')
          online.joinRoom(code)
        }}
        onlineError={online.error}
        onlineBusy={online.status === 'connecting'}
      />
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
        onStart={online.startGame}
        onSetColor={online.setColor}
        onLeave={() => {
          online.leaveRoom()
          setPlayMode('menu')
        }}
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
        myPlayerId={online.playerId}
        canRoll={online.canRollInitiative && online.status === 'initiative'}
        isRolling={online.isRolling}
        shownDice={online.shownDice}
        onRoll={online.rollInitiative}
        onLeave={() => {
          online.leaveRoom()
          setPlayMode('menu')
        }}
        modeLabel={`Онлайн · ${online.room.code}`}
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
        myPlayerId={roller}
        canRoll={
          local.state.phase === 'initiative' &&
          roller !== null &&
          !local.isRolling
        }
        isRolling={local.isRolling}
        shownDice={local.shownDice}
        onRoll={local.rollInitiative}
        onLeave={() => {
          local.newGame()
          setPlayMode('menu')
        }}
        modeLabel="Локальная игра"
      />
    )
  }

  if (effectiveMode === 'local') {
    return (
      <LocalGameView
        local={local}
        devOpen={devOpen}
        setDevOpen={setDevOpen}
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
        onExitToMenu={() => {
          online.leaveRoom()
          setPlayMode('menu')
        }}
      />
    )
  }

  return (
    <StartScreen
      onStartLocal={(count, colors) => {
        setPlayMode('local')
        local.startGame(count, colors)
      }}
      onCreateOnline={(count) => {
        setPlayMode('online')
        online.createRoom(count)
      }}
      onJoinOnline={(code) => {
        setPlayMode('online')
        online.joinRoom(code)
      }}
      onlineError={online.error ?? 'Подключение…'}
      onlineBusy
    />
  )
}

type LocalGameViewProps = {
  local: ReturnType<typeof useGame>
  devOpen: boolean
  setDevOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  onExit: () => void
}

function LocalGameView({ local, devOpen, setDevOpen, onExit }: LocalGameViewProps) {
  const { state, isRolling, shownDice } = local
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId)
  const winner = state.winner
    ? state.players.find((p) => p.id === state.winner)
    : undefined
  const canRoll = state.phase === 'waitingForRoll' && !isRolling

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Dice Grid · локально</p>
          <h1 className="app__title">Игровое поле</h1>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          Новая игра
        </button>
      </header>

      <main className="app__layout">
        <section className="panel panel--side">
          <h2 className="panel__title">Игроки</h2>
          <PlayerList
            players={state.players}
            currentPlayerId={state.currentPlayerId}
          />
          <ActionLog entries={state.log} />
        </section>

        <section className="panel panel--board">
          <Board
            board={state.board}
            players={state.players}
            availableActions={state.availableActions}
            winningCells={state.winningCells}
            showTargets={state.phase === 'selectingCell' && !isRolling}
            interactive={state.phase === 'selectingCell' && !isRolling}
            accentColor={currentPlayer?.color}
            onSelect={local.selectCell}
          />
        </section>

        <section className="panel panel--controls">
          <GameStatus
            phase={state.phase}
            currentPlayer={currentPlayer}
            dice={state.dice}
            availableActions={state.availableActions}
            isRolling={isRolling}
          />

          <Dice dice={shownDice} isRolling={isRolling} />

          {state.phase === 'turnSkipped' ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={local.completeSkip}
            >
              Завершить ход
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canRoll}
              onClick={local.roll}
            >
              Бросить кубики
            </button>
          )}

          <DevPanel
            open={devOpen}
            onToggle={() => setDevOpen((v) => !v)}
            players={state.players}
            canAct={!isRolling && state.phase !== 'initiative'}
            canRoll={canRoll || state.phase === 'initiative'}
            onRollWithValues={local.rollWithValues}
            onClearBoard={local.devClearBoard}
            onNextPlayer={local.devNextPlayer}
            onSetCell={local.devSetCell}
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
            local.startGame(state.playersCount, colors)
          }}
          onExitToMenu={onExit}
        />
      ) : null}
    </div>
  )
}

type OnlineGameViewProps = {
  online: ReturnType<typeof useOnlineGame>
  onExitToMenu: () => void
}

function OnlineGameView({ online, onExitToMenu }: OnlineGameViewProps) {
  const game = online.game!
  const currentPlayer = game.players.find((p) => p.id === game.currentPlayerId)
  const winner = game.winner
    ? game.players.find((p) => p.id === game.winner)
    : undefined

  const canRoll =
    online.isMyTurn && game.phase === 'waitingForRoll' && !online.isRolling
  const canSelect =
    online.isMyTurn && game.phase === 'selectingCell' && !online.isRolling
  const canSkip =
    online.isMyTurn && game.phase === 'turnSkipped' && !online.isRolling

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">
            Dice Grid · онлайн · код {online.room?.code}
            {online.playerId ? ` · вы: Игрок ${online.playerId}` : ''}
          </p>
          <h1 className="app__title">Игровое поле</h1>
        </div>
        <div className="app__header-actions">
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
          <ActionLog entries={game.log} />
        </section>

        <section className="panel panel--board">
          <Board
            board={game.board}
            players={game.players}
            availableActions={game.availableActions}
            winningCells={game.winningCells}
            showTargets={game.phase === 'selectingCell' && !online.isRolling}
            interactive={canSelect}
            accentColor={currentPlayer?.color}
            onSelect={online.selectCell}
          />
        </section>

        <section className="panel panel--controls">
          <GameStatus
            phase={game.phase}
            currentPlayer={currentPlayer}
            dice={game.dice}
            availableActions={game.availableActions}
            isRolling={online.isRolling}
          />

          {!online.isMyTurn && game.phase !== 'gameOver' ? (
            <p className="app__turn-hint">Сейчас ход другого игрока.</p>
          ) : null}

          <Dice dice={online.shownDice} isRolling={online.isRolling} />

          {game.phase === 'turnSkipped' ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canSkip}
              onClick={online.completeSkip}
            >
              Завершить ход
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canRoll}
              onClick={online.roll}
            >
              Бросить кубики
            </button>
          )}
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
