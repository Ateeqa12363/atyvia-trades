// Extracts the caller's phone number out of a Retell transcript.
//
// The voice agent always asks for a contact number, and callers read it out in
// all sorts of ways: "07700 900123", "oh seven seven double oh nine hundred",
// "zero seven seven zero zero, nine zero zero, one two three". We normalise
// spoken digits to figures, then pull out anything that looks like a UK number.

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  nought: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

type Turn = { role?: string; content?: string };

function turnsOf(transcript: unknown): Turn[] {
  if (!transcript) return [];
  if (Array.isArray(transcript)) return transcript as Turn[];
  if (typeof transcript === "string") {
    return transcript
      .split("\n")
      .map((line) => {
        const m = line.match(/^(agent|user|assistant|caller|customer|bot|ai|human)\s*:\s*(.*)$/i);
        return m ? { role: m[1].toLowerCase(), content: m[2] } : { content: line };
      })
      .filter((t) => (t.content ?? "").trim());
  }
  return [];
}

/** Turns spoken digits into figures so "double oh seven" becomes "007". */
function spokenToDigits(text: string): string {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out: string[] = [];
  let repeat = 0;
  for (const raw of tokens) {
    if (raw === "double") {
      repeat = 2;
      continue;
    }
    if (raw === "triple" || raw === "treble") {
      repeat = 3;
      continue;
    }
    if (raw === "hundred") {
      out.push("00");
      continue;
    }
    if (raw === "thousand") {
      out.push("000");
      continue;
    }
    const digit = DIGIT_WORDS[raw] ?? (/^\d+$/.test(raw) ? raw : null);
    if (digit) {
      out.push(repeat > 1 ? digit.repeat(repeat) : digit);
      repeat = 0;
      continue;
    }
    // A non-numeric word breaks the run of digits.
    out.push(" ");
    repeat = 0;
  }
  return out.join("");
}

/** Formats a run of digits as a readable UK number, e.g. 07700 900123. */
function formatUk(digits: string): string | null {
  let d = digits;
  if (d.startsWith("0044")) d = `0${d.slice(4)}`;
  else if (d.startsWith("44") && d.length >= 12) d = `0${d.slice(2)}`;
  if (!d.startsWith("0")) {
    // A bare mobile without its leading zero ("7700900123").
    if (d.length === 10 && d.startsWith("7")) d = `0${d}`;
    else return null;
  }
  if (d.length < 10 || d.length > 11) return null;
  if (d.startsWith("07")) return `${d.slice(0, 5)} ${d.slice(5)}`;
  if (d.startsWith("02")) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

const USER_ROLES = new Set(["user", "caller", "customer", "human", ""]);

/**
 * Best-effort phone number spoken by the caller. Prefers numbers given by the
 * customer (not the agent reading the business number back).
 */
export function extractCallerPhone(transcript: unknown): string | null {
  const turns = turnsOf(transcript);
  if (!turns.length) return null;

  const fromTurns = (predicate: (t: Turn) => boolean): string | null => {
    for (const t of turns) {
      if (!predicate(t)) continue;
      const digits = spokenToDigits(t.content ?? "");
      // Longest candidate run wins — callers often pause mid-number.
      const runs = digits.split(/\s+/).filter((r) => r.length >= 10);
      for (const run of runs.sort((a, b) => b.length - a.length)) {
        const formatted = formatUk(run.slice(0, 13));
        if (formatted) return formatted;
      }
    }
    return null;
  };

  return (
    fromTurns((t) => USER_ROLES.has((t.role ?? "").toLowerCase())) ??
    fromTurns(() => true)
  );
}
