// 最小 HTTP 服务 —— 演示多阶段 Docker 构建
// 用 pino 做结构化日志,这样 deps 阶段有真实的 npm 依赖可以演示
import { createServer } from 'node:http'
import pino from 'pino'

const port = Number(process.env.PORT ?? 3000)
const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })
const startedAt = new Date().toISOString()

const server = createServer((req, res) => {
  if (req.url === '/health') {
    log.info({ path: req.url }, 'health check')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', startedAt }))
    return
  }
  log.info({ path: req.url }, 'request')
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('this is a app...\n')
})

server.listen(port, () => {
  log.info({ port, startedAt }, 'app started')
})