/**
 * 业务「日历日」统一用亚洲/上海时区，避免与 UTC（toISOString）混用导致跨日错位。
 * 快照、历史记录、行情日期等均应通过本文件取「今天」。
 */

/** 上海时区当前日期，格式 YYYY-MM-DD（与 toLocaleDateString en-CA 一致） */
export function getShanghaiDateString(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Shanghai',
  });
}

/** 任意时刻转为上海日历日 YYYY-MM-DD（用于日期选择器变更后落库） */
export function formatInstantToShanghaiDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Shanghai',
  });
}

/** YYYY-MM-DD → 本地 Date（用于原生 DatePicker 的 value） */
export function shanghaiYmdToLocalNoon(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date();
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10);
  const day = parseInt(m[3]!, 10);
  return new Date(y, mo - 1, day, 12, 0, 0, 0);
}

/** 上海日历日 YYYY-MM-DD 加减整数天，仍返回 YYYY-MM-DD（用于行情区间等） */
export function addCalendarDaysToShanghaiYmd(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10) - 1;
  const d = parseInt(m[3]!, 10);
  const utcNoon = Date.UTC(y, mo, d, 12, 0, 0);
  const shifted = new Date(utcNoon + deltaDays * 86400000);
  return formatInstantToShanghaiDateString(shifted);
}
