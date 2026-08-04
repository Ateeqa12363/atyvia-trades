// Server-only: reads the caller's name out of a Retell transcript with an LLM.
//
// The regex heuristics in `caller-name.ts` are fast but can't cope with the
// common real-world cases:
//   - the caller spells the name out ("J - U - L - I - A")
//   - the caller corrects the agent ("no, Julia with a J")
//   - the agent mis-hears and writes "Guilia" into the booking
// This helper asks the model to reconstruct the exact spelling the caller gave.

const SYSTEM = `You extract the customer's name from a phone call transcript between an AI receptionist and a caller.

Rules:
- Return the caller's (customer's) name only — never the receptionist/agent name, and never the business name.
- If the caller SPELLS their name out letter by letter (e.g. "J, U, L, I, A" or "J-U-L-I-A"), reconstruct the name from those letters. The spelled-out letters are ALWAYS the correct spelling and override anything the agent said or repeated.
- If the caller corrects the agent's spelling or pronunciation, use the caller's correction.
- Use proper capitalisation (e.g. "Julia Foxtrot", "O'Brien", "McDonald").
- Include a surname only if the caller actually gave one.
- If no caller name is present, return null.
Return JSON only.`;

function transcriptToText(t: unknown): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    return t
      .map((turn) => {
        const r = (turn as { role?: string }).role ?? "";
        const c = (turn as { content?: string }).content ?? "";
        return `${r}: ${c}`;
      })
      .join("\n");
  }
  return "";
}

export async function aiExtractCallerName(
  transcript: unknown,
  opts?: { summary?: string | null; agentGuess?: string | null },
): Promise<string | null> {
  const text = transcriptToText(transcript).slice(0, 20000);
  if (!text.trim()) return null;
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const userContent = [
    opts?.agentGuess ? `The system currently has this name recorded (may be mis-spelled): ${opts.agentGuess}` : "",
    opts?.summary ? `Call summary: ${opts.summary}` : "",
    `Transcript:\n${text}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "caller_name",
            schema: {
              type: "object",
              properties: {
                name: { type: ["string", "null"] },
                spelled_out: { type: "boolean" },
              },
              required: ["name", "spelled_out"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: { name?: string | null } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          return null;
        }
      }
    }
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!name || name.length > 60) return null
    if (/^(unknown|n\/a|none|null|customer|caller)$/i.test(name)) return null;
    return name;
  } catch {
    return null;
  }
}

/** Last 9 digits of a phone number — good enough to match across formats. */
export function phoneKey(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-9);
}
