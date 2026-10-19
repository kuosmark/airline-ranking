// An in-flight request may finish while hidden, but no new requests start there.
export function startVisiblePolling(page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>, poll: () => Promise<void>) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let isRunning = false;
  let isStopped = false;

  async function run(): Promise<void> {
    if (page.hidden || isRunning || isStopped) { return; }
    isRunning = true;
    try { await poll(); }
    finally { isRunning = false; }
  }

  function update(): void {
    clearInterval(timer);
    if (page.hidden) { return; }
    void run();
    timer = setInterval(() => { void run(); }, 60_000);
  }

  page.addEventListener('visibilitychange', update);
  update();
  return () => {
    isStopped = true;
    clearInterval(timer);
    page.removeEventListener('visibilitychange', update);
  };
}
