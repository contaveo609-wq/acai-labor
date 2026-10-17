import { laborService } from "./labor.service";
let timer: ReturnType<typeof setInterval> | undefined;
export function startWhatsAppWorker() {
  if (timer) return;
  let busy = false;
  let lastOperations = 0;
  timer = setInterval(() => {
    if (busy) return;
    busy = true;
    const operations =
      Date.now() - lastOperations > 30000 ? laborService.operations.tick() : Promise.resolve();
    if (Date.now() - lastOperations > 30000) lastOperations = Date.now();
    void operations
      .then(() => laborService.whatsapp.runOnce())
      .catch(() => {
        /* No payloads or credentials in logs. Durable queue retries on next tick. */
      })
      .finally(() => {
        busy = false;
      });
  }, 2000);
  timer.unref();
}
