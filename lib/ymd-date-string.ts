/** 解析 YYYY-MM-DD（月、日允许 1–2 位，不补零，便于分栏输入） */
export function parseYmd(s: string): { y: string; m: string; d: string } {
  const t = s.trim();
  const full = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (full) {
    return {
      y: full[1]!,
      m: full[2]!,
      d: full[3]!,
    };
  }
  const ym = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (ym) {
    return { y: ym[1]!, m: ym[2]!, d: '' };
  }
  if (/^\d{1,4}$/.test(t)) {
    return { y: t.slice(0, 4), m: '', d: '' };
  }
  return { y: '', m: '', d: '' };
}

/** 由年/月/日分栏拼成字符串；输入过程中不补零，保存前由校验要求两位月日 */
export function buildYmdString(y: string, m: string, d: string): string {
  const ys = y.replace(/\D/g, '').slice(0, 4);
  const ms = m.replace(/\D/g, '').slice(0, 2);
  const ds = d.replace(/\D/g, '').slice(0, 2);
  if (!ys && !ms && !ds) return '';
  if (ys && !ms && !ds) return ys;
  if (ys && ms && !ds) return `${ys}-${ms}`;
  if (ys && ms && ds) return `${ys}-${ms}-${ds}`;
  return ys ? `${ys}-${ms}` : '';
}
