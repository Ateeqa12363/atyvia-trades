/** Shared helpers for matching a customer across calls / visits / quotes. */

export const nameKey = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True when two customer names very likely refer to the same person. */
export function sameName(a: string | null | undefined, b: string | null | undefined) {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const xs = x.split(" ");
  const ys = y.split(" ");
  // Same surname + same first initial ("J Foxtrot" ~ "Julia Foxtrot")
  if (xs.length > 1 && ys.length > 1 && xs.at(-1) === ys.at(-1) && xs[0][0] === ys[0][0]) return true;
  // One is contained in the other ("julia" in "julia foxtrot")
  return x.includes(y) || y.includes(x);
}

/** Last 9 digits of a phone number — comparable across +44 / 0 prefixes. */
export const phoneKeyOf = (p: string | null | undefined) => {
  const digits = (p ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
};
