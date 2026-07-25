import { createServer } from "node:http"

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
