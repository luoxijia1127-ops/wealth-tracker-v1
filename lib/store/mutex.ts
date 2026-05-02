/**
 * 单 worker FIFO mutex：保证持久化 mutation 串行执行，避免并发写覆盖
 * （例如 syncNetWorthFromMarket 与 updateAsset 同时写 assets key）。
 *
 * 任意 task 的 reject 不会阻塞后续 task。
 */
export class Mutex {
  private chain: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task, task);
    /** 让链不持有 reject 状态，否则下游 task 会被挂掉 */
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next as Promise<T>;
  }
}

/** 全局持久化 mutation 的串行队列。 */
export const persistMutex = new Mutex();
