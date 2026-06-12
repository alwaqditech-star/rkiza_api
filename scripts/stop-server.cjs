const { freePort, checkExistingApi } = require('./port-utils.cjs');

const PORT = parseInt(process.env.PORT, 10) || 3001;

async function main() {
  const running = await checkExistingApi(PORT);
  if (!running) {
    console.log(`[INFO] No API server found on port ${PORT}`);
  }

  const freed = await freePort(PORT);
  if (freed) {
    console.log(`[OK] Port ${PORT} is now free`);
  } else {
    console.log(`[INFO] Port ${PORT} was already free`);
  }
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
