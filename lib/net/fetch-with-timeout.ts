/**
 * 网络请求统一超时 / abort 封装。用于：
 * - 避免弱网时 fetch 永远不返回导致 UI 一直 loading；
 * - 让调用方可以把外部 signal（例如组件卸载时触发的 AbortController）串联进来。
 */

export type FetchWithTimeoutOptions = RequestInit & {
  /** 超时毫秒；默认 8000，与历史 withTimeout 封装一致 */
  timeoutMs?: number;
  /** 外部传入的 signal（组件卸载等），会与内部超时 signal 任意一方触发就 abort */
  parentSignal?: AbortSignal;
};

/**
 * 同时支持超时与外部取消。任一条件命中即 abort。
 * 返回值与原生 fetch 等价；超时/取消会抛 AbortError。
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 8000,
    parentSignal,
    signal: passthroughSignal,
    ...rest
  } = options;

  const ac = new AbortController();
  const timer =
    timeoutMs > 0 ? setTimeout(() => ac.abort(), timeoutMs) : null;

  const forward = (): void => ac.abort();
  if (parentSignal) {
    if (parentSignal.aborted) ac.abort();
    else parentSignal.addEventListener('abort', forward, { once: true });
  }
  if (passthroughSignal) {
    if (passthroughSignal.aborted) ac.abort();
    else passthroughSignal.addEventListener('abort', forward, { once: true });
  }

  try {
    return await fetch(input, { ...rest, signal: ac.signal });
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener('abort', forward);
    passthroughSignal?.removeEventListener('abort', forward);
  }
}

/**
 * 调用异步任务的超时包装；任务内部需支持 AbortSignal。
 * 任务抛错或超时时返回 null。和历史 withTimeout 保持一致。
 */
export async function withTimeoutNullable<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal
): Promise<T | null> {
  const ac = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => ac.abort(), timeoutMs) : null;
  const forward = (): void => ac.abort();
  if (parentSignal) {
    if (parentSignal.aborted) ac.abort();
    else parentSignal.addEventListener('abort', forward, { once: true });
  }
  try {
    return await run(ac.signal);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener('abort', forward);
  }
}
