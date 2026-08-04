// Extracts the caller's name from a Retell transcript.
//
// The voice agent (Sarah) always asks for the caller's full name, then
// confirms it back with "Thanks, <Name>." Two-pass heuristic:
//   1. Prefer the agent's own "Thanks, <Name>" / "Thank you, <Name>"
//      confirmations — the LLM has already parsed the name.
//   2. Fall back to the user turn immediately after the agent asks
//      "can I take your full name" / "what's your full name" / etc.
//   3. Last-resort: classic "my name is X" / "this is X" patterns.

// Require each name part to start with a capital and have at least 2
// alphabetic chars before any apostrophe/hyphen — stops "I'll", "I'm",
// "It's" from being captured as names.
// Each name part: capital + at least 2 more letters (blocks "Oh", "In", "It").
const NAME_TOKEN =
  "([A-Z][a-zA-Z]{2,20}(?:['\u2019\\-][a-zA-Z]{1,20})?(?:[.\\s]+[A-Z][a-zA-Z]{2,20}(?:['\u2019\\-][a-zA-Z]{1,20})?){0,2})";

const AGENT_ROLES = new Set(["agent", "assistant", "bot", "ai"]);
const USER_ROLES = new Set(["user", "caller", "customer", "human"]);

// Agent typically confirms with a single first name: "Thanks, Ben."
const FIRST_NAME_TOKEN = "([A-Z][a-z]{1,20}(?:['\u2019\\-][a-z]{1,20})?)";
const AGENT_THANKS_PATTERNS: RegExp[] = [
  new RegExp(`\\b(?:thanks|thank you|great|perfect|all right|alright|okay|ok),\\s+${FIRST_NAME_TOKEN}(?=[\\s.,!?]|$)`),
  new RegExp(`\\bbooked (?:in )?for you,?\\s+${FIRST_NAME_TOKEN}(?=[\\s.,!?:]|$)`),
];

const ASK_NAME_RE =
  /\b(?:your full name|take your (?:full )?name|grab your (?:full )?name|can i (?:get|have|take) your name|what(?:'s| is) your (?:full )?name|start with your (?:full )?name|may i (?:get|have|take) your name)\b/i;

const SELF_INTRO_PATTERNS: RegExp[] = [
  new RegExp(`\\bmy name(?:'s| is)\\s+${NAME_TOKEN}`, "i"),
  new RegExp(`\\bthis is\\s+${NAME_TOKEN}(?=[.,!?]|$)`, "i"),
  new RegExp(`\\byou'?re speaking (?:to|with)\\s+${NAME_TOKEN}`, "i"),
  new RegExp(`\\b(?:i am|i'?m)\\s+${NAME_TOKEN}(?=[\\s.,!?]|$)`, "i"),
];

// Common English words / agent-address terms that can look like names but aren't.
const STOPWORDS = new Set([
  "sarah", "sir", "madam", "mate", "friend", "there", "again",
  "calling", "here", "speaking", "just", "actually", "sorry",
  "looking", "trying", "hoping", "wondering", "afraid",
  "yes", "no", "please", "thanks", "thank", "sure", "good", "fine", "well",
  "for", "and", "but", "with", "your", "our", "the", "that", "this",
  "these", "those", "what", "when", "where", "who", "why", "how",
  "can", "could", "would", "should", "will", "shall", "may", "might",
  "am", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "get", "got", "let",
  "now", "then", "one", "two", "three", "four", "five",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "morning", "afternoon", "evening", "tomorrow", "today", "tonight",
  "next", "last", "week", "weekend",
  "okay", "hello", "hi", "hey", "bye", "goodbye",
  "not",
]);

// Common lead-in fillers the user says before their name.
const LEAD_IN_RE =
  /^\s*(?:(?:it'?s|it is|so|yeah|yes|sure|okay|ok|well|um+|uh+|er+|ah+|hi|hello|hey)[\s,.!-]+)+/i;

function titleCase(s: string): string {
  return s
    .replace(/\./g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function clean(candidate: string): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim().replace(/[.,!?;:]+$/, "");
  if (!trimmed) return null;
  const parts = trimmed.split(/[.\s]+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 3) return null;
  if (parts.some((p) => STOPWORDS.has(p.toLowerCase()))) return null;
  if (parts.some((p) => p.length < 2)) return null;
  if (parts.some((p) => !/^[A-Za-z''\-]+$/.test(p))) return null;
  return titleCase(parts.join(" "));
}

type Turn = { role?: string; content?: string };

function turnsFromString(text: string): Turn[] {
  const lines = text.split("\n");
  const turns: Turn[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(agent|user|assistant|caller|customer|bot|ai|human)\s*:\s*(.*)$/i);
    if (m) turns.push({ role: m[1].toLowerCase(), content: m[2] });
    else if (turns.length)
      turns[turns.length - 1].content =
        (turns[turns.length - 1].content ?? "") + " " + line;
  }
  return turns;
}

function normalizeTranscript(transcript: unknown): Turn[] {
  if (!transcript) return [];
  if (typeof transcript === "string") return turnsFromString(transcript);
  if (Array.isArray(transcript)) return transcript as Turn[];
  return [];
}

function extractFromUserUtterance(text: string): string | null {
  if (!text) return null;
  const stripped = text.replace(LEAD_IN_RE, "").trim();
  // Try the leading token(s) as the name first — that's the common case
  // after the agent asks "can I take your name": "Ben Stokes." / "Giulia Foxtrot."
  const leading = stripped.match(new RegExp(`^${NAME_TOKEN}`));
  if (leading?.[1]) {
    const name = clean(leading[1]);
    if (name) return name;
  }
  for (const pattern of SELF_INTRO_PATTERNS) {
    const m = text.match(pattern);
    if (m?.[1]) {
      const name = clean(m[1]);
      if (name) return name;
    }
  }
  return null;
}

export function extractCallerName(transcript: unknown): string | null {
  const turns = normalizeTranscript(transcript);
  if (!turns.length) return null;

  // Pass 1: user turn(s) immediately after the agent asks for their name.
  // This is the most accurate source — the user speaks their own full name.
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (!AGENT_ROLES.has((t.role ?? "").toLowerCase())) continue;
    if (!ASK_NAME_RE.test(t.content ?? "")) continue;
    for (let j = i + 1; j < turns.length; j++) {
      const next = turns[j];
      const role = (next.role ?? "").toLowerCase();
      if (AGENT_ROLES.has(role)) break;
      if (!role || USER_ROLES.has(role)) {
        const name = extractFromUserUtterance(next.content ?? "");
        if (name) return name;
      }
    }
  }

  // Pass 2: agent's own confirmations ("Thanks, Ben.") — first-name only fallback.
  for (const t of turns) {
    if (!AGENT_ROLES.has((t.role ?? "").toLowerCase())) continue;
    const content = t.content ?? "";
    for (const pattern of AGENT_THANKS_PATTERNS) {
      const m = content.match(pattern);
      if (m?.[1]) {
        const name = clean(m[1]);
        if (name) return name;
      }
    }
  }

  // Pass 3: any self-introduction anywhere in user turns.
  const userText = turns
    .filter((t) => !t.role || USER_ROLES.has((t.role ?? "").toLowerCase()))
    .map((t) => t.content ?? "")
    .join(" \n ");
  for (const pattern of SELF_INTRO_PATTERNS) {
    const m = userText.match(pattern);
    if (m?.[1]) {
      const name = clean(m[1]);
      if (name) return name;
    }
  }

  return null;
}
