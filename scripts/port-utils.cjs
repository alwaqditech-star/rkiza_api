const http = require('http');
const net = require('net');

function checkExistingApi(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(!!(json.success && json.database));
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, '127.0.0.1');
  });
}

async function freePort(port) {
  const { execSync } = require('child_process');
  try {
    const output = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: 'utf8' }
    ).trim();

    if (!output) return false;

    const pids = output.split(/\s+/).filter(Boolean);
    for (const pid of pids) {
      try {
        execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`);
      } catch {
        // ignore
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    return true;
  } catch {
    return false;
  }
}

module.exports = { checkExistingApi, isPortAvailable, freePort };
