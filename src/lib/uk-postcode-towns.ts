// Map UK outward postcodes (e.g. "HP19") to the town/city people actually say.
// District-level overrides come first (postcode areas often span several towns —
// HP1 is Hemel Hempstead but HP19 is Aylesbury), then a plain area fallback.

/** "HP18-22:Aylesbury" or "HP4:Berkhamsted" */
const DISTRICT_SPECS = [
  // Buckinghamshire / Herts
  "HP1-3:Hemel Hempstead",
  "HP4:Berkhamsted",
  "HP5:Chesham",
  "HP6-7:Amersham",
  "HP8:Chalfont St Giles",
  "HP9:Beaconsfield",
  "HP10-15:High Wycombe",
  "HP16:Great Missenden",
  "HP17-22:Aylesbury",
  "HP23:Tring",
  "HP27:Princes Risborough",
  "MK1-19:Milton Keynes",
  "MK40-46:Bedford",
  "AL1-4:St Albans",
  "AL5-6:Harpenden",
  "AL7-8:Welwyn Garden City",
  "AL9:Hatfield",
  "AL10:Hatfield",
  "WD1-9:Watford",
  "WD17-19:Watford",
  "WD23:Bushey",
  "WD24-25:Watford",
  "WD6:Borehamwood",
  "WD7:Radlett",
  "SG1-2:Stevenage",
  "SG4:Hitchin",
  "SG5:Hitchin",
  "SG6:Letchworth",
  "SG7:Baldock",
  "SG8:Royston",
  "SG12-14:Ware",
  // Berks / Bucks / Oxon
  "SL1-3:Slough",
  "SL4:Windsor",
  "SL5:Ascot",
  "SL6:Maidenhead",
  "SL7:Marlow",
  "SL8-9:Gerrards Cross",
  "RG1-7:Reading",
  "RG12:Bracknell",
  "RG14-20:Newbury",
  "RG21-29:Basingstoke",
  "RG30-31:Reading",
  "OX1-4:Oxford",
  "OX10:Wallingford",
  "OX11:Didcot",
  "OX14:Abingdon",
  "OX16-17:Banbury",
  "OX26-27:Bicester",
  "OX28-29:Witney",
  // Beds
  "LU1-4:Luton",
  "LU5:Dunstable",
  "LU6:Dunstable",
  "LU7:Leighton Buzzard",
] as const;

/** Postcode area (letters only) → main town/city. */
const AREA_TOWNS: Record<string, string> = {
  AB: "Aberdeen", AL: "St Albans", B: "Birmingham", BA: "Bath", BB: "Blackburn",
  BD: "Bradford", BH: "Bournemouth", BL: "Bolton", BN: "Brighton", BR: "Bromley",
  BS: "Bristol", CA: "Carlisle", CB: "Cambridge", CF: "Cardiff", CH: "Chester",
  CM: "Chelmsford", CO: "Colchester", CR: "Croydon", CT: "Canterbury", CV: "Coventry",
  CW: "Crewe", DA: "Dartford", DD: "Dundee", DE: "Derby", DG: "Dumfries",
  DH: "Durham", DL: "Darlington", DN: "Doncaster", DT: "Dorchester", DY: "Dudley",
  E: "London", EC: "London", EH: "Edinburgh", EN: "Enfield", EX: "Exeter",
  FK: "Falkirk", FY: "Blackpool", G: "Glasgow", GL: "Gloucester", GU: "Guildford",
  HA: "Harrow", HD: "Huddersfield", HG: "Harrogate", HP: "Hemel Hempstead",
  HR: "Hereford", HU: "Hull", HX: "Halifax", IG: "Ilford", IP: "Ipswich",
  IV: "Inverness", KA: "Kilmarnock", KT: "Kingston upon Thames", KY: "Kirkcaldy",
  L: "Liverpool", LA: "Lancaster", LD: "Llandrindod Wells", LE: "Leicester",
  LL: "Llandudno", LN: "Lincoln", LS: "Leeds", LU: "Luton", M: "Manchester",
  ME: "Maidstone", MK: "Milton Keynes", ML: "Motherwell", N: "London",
  NE: "Newcastle upon Tyne", NG: "Nottingham", NN: "Northampton", NP: "Newport",
  NR: "Norwich", NW: "London", OL: "Oldham", OX: "Oxford", PA: "Paisley",
  PE: "Peterborough", PH: "Perth", PL: "Plymouth", PO: "Portsmouth",
  PR: "Preston", RG: "Reading", RH: "Redhill", RM: "Romford", S: "Sheffield",
  SA: "Swansea", SE: "London", SG: "Stevenage", SK: "Stockport", SL: "Slough",
  SM: "Sutton", SN: "Swindon", SO: "Southampton", SP: "Salisbury", SR: "Sunderland",
  SS: "Southend-on-Sea", ST: "Stoke-on-Trent", SW: "London", SY: "Shrewsbury",
  TA: "Taunton", TD: "Galashiels", TF: "Telford", TN: "Tunbridge Wells",
  TQ: "Torquay", TR: "Truro", TS: "Middlesbrough", TW: "Twickenham",
  UB: "Uxbridge", W: "London", WA: "Warrington", WC: "London", WD: "Watford",
  WF: "Wakefield", WN: "Wigan", WR: "Worcester", WS: "Walsall", WV: "Wolverhampton",
  YO: "York", ZE: "Lerwick",
};

const DISTRICT_TOWNS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const spec of DISTRICT_SPECS) {
    const [code, town] = spec.split(":");
    const m = code.match(/^([A-Z]{1,2})(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const area = m[1];
    const from = Number(m[2]);
    const to = m[3] ? Number(m[3]) : from;
    for (let n = from; n <= to; n += 1) out[`${area}${n}`] = town;
  }
  return out;
})();

/** Outward code (e.g. "HP19") → "Aylesbury". Returns null when unknown. */
export function townForOutwardCode(code: string | null): string | null {
  if (!code) return null;
  const c = code.toUpperCase().replace(/\s+/g, "");
  const district = c.match(/^([A-Z]{1,2}\d+)/)?.[1];
  if (district && DISTRICT_TOWNS[district]) return DISTRICT_TOWNS[district];
  const area = c.match(/^([A-Z]{1,2})/)?.[1];
  return (area && AREA_TOWNS[area]) || null;
}
