export function telegramHref(tg) {
  if (tg == null || !String(tg).trim()) return null;
  const t = String(tg).trim().replace(/^@/, '');
  if (!t) return null;
  return `https://t.me/${t}`;
}

export function phoneHref(phone) {
  if (phone == null || !String(phone).trim()) return null;
  const raw = String(phone).replace(/\s/g, '');
  if (!raw) return null;
  return raw.startsWith('+') ? `tel:${raw}` : `tel:${raw}`;
}
