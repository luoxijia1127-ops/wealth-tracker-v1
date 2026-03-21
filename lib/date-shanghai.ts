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
