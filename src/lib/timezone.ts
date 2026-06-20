// US state → time-zone bucket per the spec (Eastern/Central/Mountain/Pacific…).
// Split states are mapped to where most of their population sits; the school
// detail page exposes a manual override.
const STATE_TZ: Record<string, string> = {
  CT: "Eastern", DE: "Eastern", DC: "Eastern", FL: "Eastern", GA: "Eastern",
  IN: "Eastern", KY: "Eastern", ME: "Eastern", MD: "Eastern", MA: "Eastern",
  MI: "Eastern", NH: "Eastern", NJ: "Eastern", NY: "Eastern", NC: "Eastern",
  OH: "Eastern", PA: "Eastern", RI: "Eastern", SC: "Eastern", TN: "Central",
  VT: "Eastern", VA: "Eastern", WV: "Eastern",
  AL: "Central", AR: "Central", IL: "Central", IA: "Central", KS: "Central",
  LA: "Central", MN: "Central", MS: "Central", MO: "Central", NE: "Central",
  ND: "Central", OK: "Central", SD: "Central", TX: "Central", WI: "Central",
  AZ: "Mountain", CO: "Mountain", ID: "Mountain", MT: "Mountain",
  NM: "Mountain", UT: "Mountain", WY: "Mountain",
  CA: "Pacific", NV: "Pacific", OR: "Pacific", WA: "Pacific",
  AK: "Alaska", HI: "Hawaii",
};

const NAME_TO_ABBR: Record<string, string> = {
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL",
  georgia: "GA", indiana: "IN", kentucky: "KY", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", "new hampshire": "NH", "new jersey": "NJ",
  "new york": "NY", "north carolina": "NC", ohio: "OH", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", tennessee: "TN", vermont: "VT",
  virginia: "VA", "west virginia": "WV", alabama: "AL", arkansas: "AR",
  illinois: "IL", iowa: "IA", kansas: "KS", louisiana: "LA", minnesota: "MN",
  mississippi: "MS", missouri: "MO", nebraska: "NE", "north dakota": "ND",
  oklahoma: "OK", "south dakota": "SD", texas: "TX", wisconsin: "WI",
  arizona: "AZ", colorado: "CO", idaho: "ID", montana: "MT", "new mexico": "NM",
  utah: "UT", wyoming: "WY", california: "CA", nevada: "NV", oregon: "OR",
  washington: "WA", alaska: "AK", hawaii: "HI",
};

export function timeZoneForState(state?: string | null): string | null {
  if (!state) return null;
  const s = state.trim();
  const abbr = s.length === 2 ? s.toUpperCase() : NAME_TO_ABBR[s.toLowerCase()];
  return abbr ? STATE_TZ[abbr] ?? null : null;
}
