import http from 'http';

export function startHealthServer({ port = 3000, getStatus }: { port?: number; getStatus: () => any }) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const status = getStatus();
      const ok = !!status.lastSuccess || !status.lastError;
      res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok, status }));
      return;
    }

    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ uptime: process.uptime() }));
      return;
    }

    res.writeHead(404).end();
  });

  server.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });

  return server;
}
