/**
 * 轻量应用错误：统一向用户展示的文案，业务层可逐步采用 throw new AppError(...) 替代散落字符串。
 */

export type AppErrorKind = 'network' | 'parse' | 'validation' | 'business' | 'unknown';

export class AppError extends Error {
  readonly kind: AppErrorKind;

  constructor(
    message: string,
    kind: AppErrorKind = 'unknown',
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'AppError';
    this.kind = kind;
  }
}

/** 将任意异常转为用户可读短句（不泄露堆栈细节） */
export function toUserMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  if (e instanceof Error && e.message.trim().length > 0) return e.message;
  return '操作失败，请稍后重试。';
}
