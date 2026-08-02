import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../shared/game/types.ts'
import { RoomManager, toPublic } from './rooms.ts'

const PORT = Number(process.env.PORT ?? 3001)
const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const rooms = new RoomManager()

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function safeJoin(root: string, requestPath: string): string | null {
  const cleaned = normalize(requestPath).replace(/^(\.\.[/\\])+/, '')
  const full = join(root, cleaned)
  if (!full.startsWith(root + sep) && full !== root) {
    return null
  }
  return full
}

function serveStatic(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
): void {
  if (!existsSync(DIST_DIR)) {
    sendJson(res, 503, {
      ok: false,
      error: 'Frontend build not found. Run npm run build.',
    })
    return
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'

  const candidate = safeJoin(DIST_DIR, pathname.slice(1))
  if (!candidate) {
    res.writeHead(403).end('Forbidden')
    return
  }

  let filePath = candidate
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = join(DIST_DIR, 'index.html')
  }

  if (!existsSync(filePath)) {
    res.writeHead(404).end('Not found')
    return
  }

  const type = MIME[extname(filePath)] ?? 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
  createReadStream(filePath).pipe(res)
}

const httpServer = createServer((req, res) => {
  const url = req.url ?? '/'

  if (url.startsWith('/api/health') || url === '/health') {
    sendJson(res, 200, { ok: true, service: 'dice-grid' })
    return
  }

  // Socket.IO handled separately by the engine
  if (url.startsWith('/socket.io')) {
    return
  }

  serveStatic(req, res)
})

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
})

function broadcastRoom(code: string): void {
  const room = rooms.getPublic(code)
  if (!room) return
  io.to(code).emit('room:updated', room)
}

function broadcastGame(code: string, dice?: { first: number; second: number }): void {
  const room = rooms.getPublic(code)
  if (!room) return
  io.to(code).emit('game:state', { room, dice })
}

rooms.onCountdownFinished = (code) => {
  broadcastGame(code)
}

rooms.onBotUpdate = (code, dice) => {
  if (dice) {
    broadcastGame(code, dice)
  } else {
    broadcastGame(code)
  }
}

io.on('connection', (socket) => {
  socket.on('room:create', (payload, callback) => {
    try {
      const result = rooms.createRoom(socket.id, payload.playersCount, payload.name)
      if (result.ok) {
        void socket.join(result.room.code)
      }
      callback(result)
      if (result.ok) {
        broadcastRoom(result.room.code)
      }
    } catch {
      callback({ ok: false, error: 'Не удалось создать комнату.' })
    }
  })

  socket.on('room:join', (payload, callback) => {
    const result = rooms.joinRoom(socket.id, payload.code, payload.name)
    if (result.ok) {
      void socket.join(result.room.code)
      callback(result)
      broadcastRoom(result.room.code)
      return
    }
    callback(result)
  })

  socket.on('room:rejoin', (payload, callback) => {
    const result = rooms.rejoinRoom(socket.id, payload.code, payload.token)
    if (result.ok) {
      void socket.join(result.room.code)
      callback(result)
      broadcastRoom(result.room.code)
      return
    }
    callback(result)
  })

  socket.on('room:start', (payload, callback) => {
    const result = rooms.startGame(socket.id, payload.code)
    callback(result)
    if (result.ok) {
      broadcastRoom(payload.code)
      rooms.scheduleBots(payload.code, 400)
    }
  })

  socket.on('room:setColor', (payload, callback) => {
    const result = rooms.setColor(socket.id, payload.code, payload.color)
    callback(result)
    if (result.ok) {
      broadcastRoom(payload.code)
    }
  })

  socket.on('room:setName', (payload, callback) => {
    const result = rooms.setName(socket.id, payload.code, payload.name)
    callback(result)
    if (result.ok) {
      broadcastRoom(payload.code)
    }
  })

  socket.on('initiative:roll', (payload, callback) => {
    const result = rooms.initiativeRoll(socket.id, payload.code)
    callback(
      result.ok
        ? { ok: true, dice: result.dice }
        : { ok: false, error: result.error },
    )
    if (result.ok) {
      broadcastRoom(payload.code)
      if (result.dice) {
        io.to(payload.code).emit('game:state', {
          room: rooms.getPublic(payload.code)!,
          dice: result.dice,
        })
      }
      rooms.scheduleBots(payload.code, 400)
    }
  })

  socket.on('room:leave', (payload, callback) => {
    const result = rooms.leaveRoom(socket.id, payload.code)
    void socket.leave(payload.code)
    callback(result)
    if (result.ok) {
      const still = rooms.getPublic(payload.code)
      if (still) {
        broadcastRoom(payload.code)
      }
    }
  })

  socket.on('room:returnToLobby', (payload, callback) => {
    const result = rooms.returnToLobby(socket.id, payload.code)
    callback(result)
    if (result.ok) {
      broadcastRoom(payload.code)
    }
  })

  socket.on('room:restartGame', (payload, callback) => {
    const result = rooms.restartGame(socket.id, payload.code)
    callback(result)
    if (result.ok) {
      broadcastGame(payload.code)
    }
  })

  socket.on('game:roll', (payload, callback) => {
    const result = rooms.roll(socket.id, payload.code)
    callback(result.ok ? { ok: true } : { ok: false, error: result.error })
    if (result.ok) {
      broadcastGame(payload.code, result.dice)
      rooms.scheduleBots(payload.code, 700)
    }
  })

  socket.on('game:selectCell', (payload, callback) => {
    const result = rooms.selectCell(socket.id, payload.code, payload.coordinate)
    callback(result)
    if (result.ok) {
      broadcastGame(payload.code)
      rooms.scheduleBots(payload.code, 800)
    }
  })

  socket.on('game:completeSkip', (payload, callback) => {
    const result = rooms.completeSkip(socket.id, payload.code)
    callback(result)
    if (result.ok) {
      broadcastGame(payload.code)
      rooms.scheduleBots(payload.code, 550)
    }
  })

  socket.on('disconnect', () => {
    const room = rooms.markDisconnected(socket.id)
    if (room) {
      io.to(room.code).emit('room:updated', toPublic(room))
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`Dice Grid listening on http://localhost:${PORT}`)
  console.log(`Static files: ${DIST_DIR}`)
})
