// The token launch radar's model: one sealed snapshot in, one ranked board out.
//
// The idea, in one paragraph. A protocol that records no token has no market price, so the radar
// borrows one from its peers: among the protocols that DO record a token, the market pays a
// market-cap-to-TVL multiple that clusters by category. Take that category's median multiple
// (winsorized so dead tokens and data glitches cannot poison it, shrunk toward the global median
// when the category has few tokenized members), multiply the protocol's own TVL by it, then adjust
// only for what the snapshot itself shows: seven-day TVL momentum, chain breadth, and seasoning
// (how long the protocol has run with no token). Two guards sit on top of that product. The
// first is for thin categories: when a category has two or fewer tokenized peers, its shrunk
// multiple is held to one and a half times the global median, because one or two peers — however
// honestly shrunk — cannot carry a whole category's premium on their own; a row the cap holds
// down says so on its face. The second: the effective multiple — the category multiple times
// the three factors — never runs past the 90th percentile of the whole tokenized population's
// winsorized multiples, so a category priced off few peers cannot outrun what the market pays
// almost everywhere else; a row the ceiling holds down says so on its face, with the uncapped
// figure beside the capped one. Round to three significant figures — the number is a claim, not
// a measurement — and rank. Every factor is printed on the detail page, so the number is
// reproducible from the snapshot by hand.
//
// The board is honest about what a launch candidate is. Before ranking, a screen sets aside
// wrapped, staked and bridged products of tokens that already trade, exchange house products,
// versioned re-releases of protocols that already trade, and any second listing of a name that
// already trades. The snapshot's watchlist is forced in whole: it is the floor, never the ceiling,
// and the rest of the board is the highest-valued screened protocols the watchlist leaves out,
// each tagged with its provenance so a reader can see which rows the house's rule would have missed.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated on the dashboard so the arithmetic is checkable. */
export interface ModelConstants {
  credibility_k: number;
  winsor_lo_pct: number;
  winsor_hi_pct: number;
  ceiling_pct: number;
  /** A category with at most this many tokenized peers is thin: its multiple gets the thin cap. */
  thin_peer_max: number;
  /** The thin cap: a thin category's shrunk multiple is held to this factor of the global median. */
  thin_cap_factor: number;
  mom_floor: number;
  mom_cap: number;
  mom_divisor: number;
  chain_step: number;
  chain_cap: number;
  young_days: number;
  seasoned_days: number;
  young_factor: number;
  seasoned_factor: number;
  board_rows: number;
}

export const MODEL: ModelConstants = {
  credibility_k: 8,
  winsor_lo_pct: 1,
  winsor_hi_pct: 99,
  ceiling_pct: 90,
  thin_peer_max: 2,
  thin_cap_factor: 1.5,
  mom_floor: -30,
  mom_cap: 50,
  mom_divisor: 200,
  chain_step: 0.05,
  chain_cap: 6,
  young_days: 90,
  seasoned_days: 730,
  young_factor: 0.85,
  seasoned_factor: 1.1,
  board_rows: 180,
};

/** The model's version label, named on the dashboard. */
export const MODEL_VERSION = 'peer-multiple-3';

/** Where a board row came from: the house's list, below its floor, or off its list at size. */
export type Provenance = 'Watchlist' | 'Below-floor' | 'Off-list';

/** One tokenized peer of a sparse category: its name and its raw market-cap-to-TVL ratio. */
export interface SparsePeer {
  name: string;
  /** The peer's raw (unwinsorized) market-cap-to-TVL ratio. */
  ratio: number;
}

/** The peer evidence behind one protocol's multiple: the category's shrunk median and its band. */
export interface PeerStats {
  /** Tokenized protocols in the category (0 when the category has none, or is null). */
  peer_count: number;
  /** The category's raw median winsorized multiple (the global median when there is no category evidence). */
  peer_median: number;
  /** The credibility-shrunk multiple, before the thin-category cap. */
  multiple_pre_thin: number;
  /** The multiple actually applied: the shrunk multiple, thin-capped when the category is thin. */
  multiple: number;
  /** Whether the thin-category cap held this category's multiple down. */
  thin_capped: boolean;
  /** Whether the category is sparse: fewer than three tokenized peers, so no peer band is shown. */
  sparse: boolean;
  /** The category's peers, named with their raw ratios, when sparse (null otherwise). */
  sparse_peers: SparsePeer[] | null;
  /** The shrunk 25th-percentile multiple of the category. */
  band_q25: number;
  /** The shrunk 75th-percentile multiple of the category. */
  band_q75: number;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  provenance: Provenance;
  model: {
    multiple: number;
    /** The shrunk category multiple before the thin-category cap. */
    multiple_pre_thin: number;
    /** Whether the thin-category cap held this row's category multiple down. */
    thin_capped: boolean;
    /** Whether the row's category is sparse (fewer than three tokenized peers): no band is shown. */
    sparse: boolean;
    /** The category's peers with raw ratios, when sparse (null otherwise). */
    sparse_peers: SparsePeer[] | null;
    peer_median: number;
    peer_count: number;
    global_median: number;
    f_mom: number;
    f_chain: number;
    f_age: number;
    /** The ceiling every effective multiple is held to: the population's ceiling_pct percentile. */
    multiple_ceiling: number;
    /** The effective multiple (category multiple x the three factors) before the ceiling. */
    multiple_uncapped: number;
    /** The effective multiple after the ceiling: the figure the implied value is priced from. */
    multiple_effective: number;
    /** Whether the ceiling held this row's effective multiple down. */
    multiple_capped: boolean;
    band_low_usd: number;
    band_high_usd: number;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row: the board row's display fields, factors, band and plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  provenance: Provenance;
  multiple: number;
  /** The shrunk category multiple before the thin-category cap. */
  multiple_pre_thin: number;
  /** Whether the thin-category cap held this row's category multiple down. */
  thin_capped: boolean;
  /** Whether the row's category is sparse (fewer than three tokenized peers): no band is shown. */
  sparse: boolean;
  /** The category's peers with raw ratios, when sparse (null otherwise). */
  sparse_peers: SparsePeer[] | null;
  peer_median: number;
  peer_count: number;
  f_mom: number;
  f_chain: number;
  f_age: number;
  multiple_ceiling: number;
  multiple_uncapped: number;
  multiple_effective: number;
  multiple_capped: boolean;
  band_low_usd: number;
  band_high_usd: number;
  farm_steps: string[];
}

/** Everything the dashboard renders. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  protocol_count: number;
  tokenless_count: number;
  watchlist_size: number;
  board_size: number;
  global_median: number;
  global_q25: number;
  global_q75: number;
  multiple_ceiling: number;
  rows: RadarRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The p-th percentile of a sorted array, linear interpolation between closest ranks. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const frac = rank - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

/** The median of a sorted array. */
function median(sorted: number[]): number {
  return percentile(sorted, 50);
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Round to three significant figures: the estimate is a claim, not a measurement. */
export function roundSig3(x: number): number {
  if (!(x > 0)) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(x)) - 2);
  return Math.round(x / p) * p;
}

/** Whether a protocol records no token: DefiLlama carries neither a CoinGecko id nor a symbol for it. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol's token already trades, by any of the snapshot's three token fields. */
function hasToken(p: SnapshotProtocol): boolean {
  return p.gecko_id !== null || p.symbol !== null || p.mcap_usd !== null;
}

/** The peer evidence: winsorized multiples of the tokenized protocols, global and per category. */
export interface PeerBook {
  global_median: number;
  global_q25: number;
  global_q75: number;
  /** The ceiling on any row's effective multiple: the ceiling_pct percentile of the winsorized population. */
  multiple_ceiling: number;
  tokenized_count: number;
  /** Stats for one category (or null): shrunk toward the global figures with the credibility weight. */
  statsFor: (category: string | null) => PeerStats;
}

/** Build the peer book from the snapshot's tokenized protocols (a recorded market cap over a positive TVL). */
export function buildPeerBook(snapshot: Snapshot, model: ModelConstants = MODEL): PeerBook {
  const tokenized = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const ratios = tokenized.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const lo = percentile(ratios, model.winsor_lo_pct);
  const hi = percentile(ratios, model.winsor_hi_pct);
  const clampR = (r: number): number => Math.min(hi, Math.max(lo, r));
  const globalWins = ratios.map(clampR).sort((a, b) => a - b);
  const g = { median: median(globalWins), q25: percentile(globalWins, 25), q75: percentile(globalWins, 75) };

  const byCategory = new Map<string, number[]>();
  const peersByCategory = new Map<string, SparsePeer[]>();
  for (const p of tokenized) {
    if (p.category === null) continue;
    const arr = byCategory.get(p.category) ?? [];
    arr.push(clampR(p.mcap_usd! / p.tvl_usd));
    byCategory.set(p.category, arr);
    const peers = peersByCategory.get(p.category) ?? [];
    peers.push({ name: p.name, ratio: p.mcap_usd! / p.tvl_usd });
    peersByCategory.set(p.category, peers);
  }
  const catStats = new Map<string, { n: number; median: number; q25: number; q75: number }>();
  for (const [cat, arr] of byCategory) {
    const sorted = arr.slice().sort((a, b) => a - b);
    catStats.set(cat, { n: sorted.length, median: median(sorted), q25: percentile(sorted, 25), q75: percentile(sorted, 75) });
  }

  const k = model.credibility_k;
  const shrink = (catValue: number, globalValue: number, n: number): number => (n * catValue + k * globalValue) / (n + k);
  return {
    global_median: g.median,
    global_q25: g.q25,
    global_q75: g.q75,
    multiple_ceiling: percentile(globalWins, model.ceiling_pct),
    tokenized_count: tokenized.length,
    statsFor: (category: string | null): PeerStats => {
      const cs = category === null ? undefined : catStats.get(category);
      if (cs === undefined) {
        return {
          peer_count: 0,
          peer_median: g.median,
          multiple_pre_thin: g.median,
          multiple: g.median,
          thin_capped: false,
          sparse: true,
          sparse_peers: [],
          band_q25: g.q25,
          band_q75: g.q75,
        };
      }
      // The thin-category cap: a category priced off one or two peers has its shrunk multiple
      // held to thin_cap_factor times the global median, before any adjustment factor applies.
      const preThin = shrink(cs.median, g.median, cs.n);
      const thinCap = model.thin_cap_factor * g.median;
      const thinCapped = cs.n <= model.thin_peer_max && preThin > thinCap;
      const sparse = cs.n < 3;
      return {
        peer_count: cs.n,
        peer_median: cs.median,
        multiple_pre_thin: preThin,
        multiple: thinCapped ? thinCap : preThin,
        thin_capped: thinCapped,
        sparse,
        sparse_peers: sparse ? (peersByCategory.get(category!) ?? []).slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) : null,
        band_q25: shrink(cs.q25, g.q25, cs.n),
        band_q75: shrink(cs.q75, g.q75, cs.n),
      };
    },
  };
}

/**
 * The three adjustment factors and the implied value one pre-token protocol gets. The cap is
 * applied here, at the last step before TVL: the effective multiple is the category multiple
 * times the three factors, and the ceiling holds that product — the final implied multiple —
 * at the population's ceiling_pct percentile, so no ordering of the factors can slip past it.
 */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  peers: PeerBook,
  model: ModelConstants = MODEL,
): {
  implied: number;
  stats: PeerStats;
  fMom: number;
  fChain: number;
  fAge: number;
  age: number | null;
  multiple_uncapped: number;
  multiple_effective: number;
  multiple_capped: boolean;
} {
  const stats = peers.statsFor(p.category);
  const age = ageDays(asOf, p.listed_at);
  const fMom = p.change_7d === null ? 1 : 1 + Math.min(model.mom_cap, Math.max(model.mom_floor, p.change_7d)) / model.mom_divisor;
  const fChain = 1 + model.chain_step * (Math.min(p.chains.length, model.chain_cap) - 1);
  const fAge = age === null ? 1 : age < model.young_days ? model.young_factor : age > model.seasoned_days ? model.seasoned_factor : 1;
  const multiple_uncapped = stats.multiple * fMom * fChain * fAge;
  const multiple_effective = Math.min(multiple_uncapped, peers.multiple_ceiling);
  const implied = roundSig3(p.tvl_usd * multiple_effective);
  return {
    implied,
    stats,
    fMom,
    fChain,
    fAge,
    age,
    multiple_uncapped,
    multiple_effective,
    multiple_capped: multiple_uncapped > peers.multiple_ceiling,
  };
}

// ------------------------------------------------------------------ the honesty screen

/** DefiLlama's version-marker rule: a name ending in a release is a re-release of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are products of a token that already trades, or an exchange's own house. */
const SCREEN_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A whole word that marks a wrapped or staked product of something else. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a house product begins with. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** A name with any version marker stripped, for spotting a second listing of a trading name. */
function stripVersion(name: string): string {
  return name.replace(VERSIONED, '');
}

/** Why the screen sets a pre-token protocol aside, or null when it is a launch candidate. */
export function screenReason(p: SnapshotProtocol, tradingNames: Set<string>): string | null {
  if (p.category !== null && SCREEN_CATEGORIES.has(p.category)) return `category ${p.category} is a product of a token that already trades`;
  if (VERSIONED.test(p.name)) return 'name ends in a version marker: a re-release of a protocol that already trades';
  if (WRAPPED_WORD.test(p.name)) return 'name carries a wrapped or staked product word';
  for (const ex of EXCHANGE_PREFIXES) {
    if (p.name === ex || p.name.startsWith(`${ex} `)) return `name begins with the exchange ${ex}`;
  }
  if (tradingNames.has(stripVersion(p.name))) return 'a protocol of this name already trades';
  return null;
}

/** The names (version markers stripped) of every protocol whose token already trades. */
function tradingNameSet(snapshot: Snapshot): Set<string> {
  const names = new Set<string>();
  for (const p of snapshot.protocols) if (hasToken(p)) names.add(stripVersion(p.name));
  return names;
}

/** A board row's provenance: the house's list, below its floor, or off its list at size. */
function provenanceOf(p: SnapshotProtocol, watchlist: Set<string>, floor: number): Provenance {
  if (watchlist.has(p.slug)) return 'Watchlist';
  return p.tvl_usd < floor ? 'Below-floor' : 'Off-list';
}

/** The board: the watchlist whole, then the highest-valued screened protocols, ranked. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const peers = buildPeerBook(snapshot, model);
  const watchlist = new Set(snapshot.watchlist);
  const tradingNames = tradingNameSet(snapshot);

  const scored: { p: SnapshotProtocol; v: ReturnType<typeof impliedValue> }[] = [];
  const rest: { p: SnapshotProtocol; v: ReturnType<typeof impliedValue> }[] = [];
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    if (watchlist.has(p.slug)) {
      scored.push({ p, v: impliedValue(p, snapshot.as_of, peers, model) });
    } else if (screenReason(p, tradingNames) === null) {
      rest.push({ p, v: impliedValue(p, snapshot.as_of, peers, model) });
    }
  }
  const byValue = (a: { p: SnapshotProtocol; v: ReturnType<typeof impliedValue> }, b: { p: SnapshotProtocol; v: ReturnType<typeof impliedValue> }): number =>
    b.v.implied - a.v.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0);
  rest.sort(byValue);
  const fill = Math.max(0, model.board_rows - scored.length);
  const all = [...scored, ...rest.slice(0, fill)].sort(byValue);

  return all.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    provenance: provenanceOf(s.p, watchlist, snapshot.floor_usd),
    model: {
      // Full precision, not rounded: the dashboard recomputes the implied value from these
      // factors and must land on the board's number exactly.
      multiple: s.v.stats.multiple,
      multiple_pre_thin: s.v.stats.multiple_pre_thin,
      thin_capped: s.v.stats.thin_capped,
      sparse: s.v.stats.sparse,
      sparse_peers: s.v.stats.sparse_peers,
      peer_median: round4(s.v.stats.peer_median),
      peer_count: s.v.stats.peer_count,
      global_median: round4(peers.global_median),
      f_mom: s.v.fMom,
      f_chain: s.v.fChain,
      f_age: s.v.fAge,
      multiple_ceiling: peers.multiple_ceiling,
      multiple_uncapped: s.v.multiple_uncapped,
      multiple_effective: s.v.multiple_effective,
      multiple_capped: s.v.multiple_capped,
      band_low_usd: Math.round(s.p.tvl_usd * s.v.stats.band_q25),
      band_high_usd: Math.round(s.p.tvl_usd * s.v.stats.band_q75),
    },
    farm_steps: farmSteps(s.p, s.v.age),
  }));
}

// ------------------------------------------------------------------ farm plans

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** A category playbook: the core action, the second action, the activity's noun, and a presence step. */
interface Play {
  core: (name: string, chain: string, cap: number) => string;
  second: (name: string, chain: string, cap: number) => string;
  noun: string;
  presence: (name: string) => string;
}

const genericPresence = (verb: string) => (name: string) =>
  `If ${name}'s interface offers a governance forum, a testnet or a waitlist, take part under the same wallet; if it offers none, leave public feedback on your experience instead.`;

/** The playbooks, keyed by the snapshot's own category names, with a generic play for the rest. */
function playFor(category: string | null): Play {
  const c = category ?? '';
  switch (c) {
    case 'Dexs':
      return {
        core: (n, ch, cap) => `Swap about $${cap} of a major pair through ${n} on ${ch}, in two or three trades rather than one, so the wallet shows real trading activity.`,
        second: (n, ch, cap) => `Provide about $${cap} of liquidity to a major pool on ${n} on ${ch} and leave it in place; unbalanced or one-sided pools do not show the same use.`,
        noun: 'trading',
        presence: genericPresence('trade'),
      };
    case 'Lending':
    case 'Uncollateralized Lending':
    case 'Collateral Markets':
      return {
        core: (n, ch, cap) => `Supply about $${cap} of USDC or the chain's main asset as collateral on ${n} on ${ch} and keep the deposit open.`,
        second: (n, ch, cap) => `Borrow a small amount against the ${n} deposit — a quarter of its value at most — hold it a few days, then repay in full so the borrow is on record.`,
        noun: 'lending',
        presence: genericPresence('lend'),
      };
    case 'CDP':
    case 'CDP Manager':
      return {
        core: (n, ch, cap) => `Open a vault on ${n} on ${ch} with about $${cap} of collateral and mint a modest amount of its stablecoin against it.`,
        second: (n, ch) => `Watch the ${n} vault's collateral ratio weekly and top it up before it nears liquidation; a vault that survives a volatile week is the activity that counts.`,
        noun: 'vault',
        presence: genericPresence('mint'),
      };
    case 'Yield':
    case 'Yield Aggregator':
    case 'Farm':
    case 'Leveraged Farming':
      return {
        core: (n, ch, cap) => `Deposit about $${cap} into a main vault or pool on ${n} on ${ch} and keep the shares rather than rotating out within days.`,
        second: (n, ch) => `Move part of the ${n} position between two of its vaults on ${ch} once, so the wallet has used more than the deposit button.`,
        noun: 'deposit',
        presence: genericPresence('deposit'),
      };
    case 'Derivatives':
    case 'Options':
    case 'Options Vault':
    case 'Interest Rate Derivatives':
    case 'Synthetics':
    case 'Basis Trading':
      return {
        core: (n, ch, cap) => `Deposit about $${cap} of margin on ${n} on ${ch} and open one small position, sized so a bad day costs little.`,
        second: (n, ch) => `Close the ${n} position after a few days and open its hedge or its opposite once, so the wallet shows trading rather than a single bet.`,
        noun: 'trading',
        presence: genericPresence('trade'),
      };
    case 'RWA':
      return {
        core: (n, ch, cap) => `Subscribe about $${cap} to the real-world asset product ${n} offers on ${ch}, completing whatever onboarding its interface asks for.`,
        second: (n, ch) => `Hold the ${n} position through a full reporting cycle on ${ch} and read the attestations it publishes, so the holding is a position and not a visit.`,
        noun: 'holding',
        presence: genericPresence('hold'),
      };
    case 'Staking Pool':
    case 'Restaking':
      return {
        core: (n, ch, cap) => `Stake about $${cap} of the chain's staking asset through ${n} on ${ch} and keep the receipt position open.`,
        second: (n, ch) => `Claim and re-stake the ${n} rewards on ${ch} once, so the wallet shows the full staking loop rather than a single deposit.`,
        noun: 'staking',
        presence: genericPresence('stake'),
      };
    case 'Cross Chain Bridge':
      return {
        core: (n, ch, cap) => `Bridge about $${cap} of USDC through ${n} to ${ch} and use the bridged funds in an app on the far side.`,
        second: (n, ch) => `Bridge a smaller amount back through ${n} a week later, so the wallet has crossed in both directions.`,
        noun: 'bridge transfer',
        presence: genericPresence('bridge'),
      };
    case 'Risk Curators':
    case 'Onchain Capital Allocator':
    case 'Liquidity Manager':
    case 'Collateral Management':
      return {
        core: (n, ch, cap) => `Deposit about $${cap} into a curated vault on ${n} on ${ch} and keep the shares for the full holding period below.`,
        second: (n, ch) => `Read the curator's notes for the ${n} vault on ${ch} and rebalance once if its strategy changes, so the position is managed, not parked and forgotten.`,
        noun: 'deposit',
        presence: genericPresence('deposit'),
      };
    case 'Stablecoin Issuer':
    case 'Algo-Stables':
    case 'Dual-Token Stablecoin':
    case 'Stablecoin Wrapper':
    case 'Reserve Currency':
      return {
        core: (n, ch, cap) => `Mint or deposit about $${cap} of the stable asset through ${n} on ${ch} and hold it in the farming wallet.`,
        second: (n, ch) => `Redeem a small part of the ${n} position on ${ch} once to prove the exit works, then re-mint it so the balance is whole again.`,
        noun: 'mint',
        presence: genericPresence('mint'),
      };
    case 'Prediction Market':
      return {
        core: (n, ch, cap) => `Fund the wallet with about $${cap} and take one position in an active market on ${n} on ${ch}.`,
        second: (n, ch) => `Take a second, smaller ${n} position in a different market on ${ch}, so the activity is a pattern and not a single ticket.`,
        noun: 'market position',
        presence: genericPresence('trade'),
      };
    case 'Launchpad':
      return {
        core: (n, ch, cap) => `Register the farming wallet on ${n} on ${ch} and, if a launch is open, complete its participation steps for that launch, staking about $${cap} if its rules ask for it.`,
        second: (n, ch) => `If a ${n} launch is open on ${ch}, take part at the smallest tier rather than watching from outside; small completed participations are what a launchpad records.`,
        noun: 'participation',
        presence: genericPresence('participate'),
      };
    case 'Chain':
      return {
        core: (n, ch, cap) => `Bridge about $${cap} of funds onto ${n} and make it the wallet's home chain for a month of ordinary transactions.`,
        second: (n, ch) => `Use two or three different apps on ${n} in the first week, so the wallet is a chain user and not a single bridge event.`,
        noun: 'transaction',
        presence: genericPresence('transact'),
      };
    case 'Insurance':
      return {
        core: (n, ch, cap) => `Buy about $${cap} of cover from ${n} on ${ch} for a position you actually hold, and keep the policy to its term.`,
        second: (n, ch) => `Renew or extend the ${n} cover on ${ch} once, so the wallet shows an ongoing insurance relationship rather than one purchase.`,
        noun: 'cover',
        presence: genericPresence('insure'),
      };
    case 'Payments':
    case 'Crypto Card Issuer':
      return {
        core: (n, ch, cap) => `Route about $${cap} of ordinary spending or one real payment through ${n} on ${ch} rather than a test transaction.`,
        second: (n, ch) => `Repeat a smaller payment through ${n} each week on ${ch}; payment products count habitual users, not one-off trials.`,
        noun: 'payment',
        presence: genericPresence('pay'),
      };
    case 'Indexes':
      return {
        core: (n, ch, cap) => `Buy about $${cap} of the index position ${n} offers on ${ch} and hold it rather than trading in and out.`,
        second: (n, ch) => `Add a smaller second purchase to the ${n} index position on ${ch} a week later, so the wallet shows accumulation.`,
        noun: 'index position',
        presence: genericPresence('hold'),
      };
    case 'Privacy':
      return {
        core: (n, ch, cap) => `Make one shielded transfer of about $${cap} through ${n} on ${ch}, following its own flow end to end.`,
        second: (n, ch) => `Unshield a smaller amount through ${n} on ${ch} after a week, so the wallet has used the full privacy loop.`,
        noun: 'shielded transfer',
        presence: genericPresence('transfer'),
      };
    case 'AI Agents':
    case 'Decentralized AI':
      return {
        core: (n, ch, cap) => `Use ${n}'s agent or inference service on ${ch} for a real task, paying its going rate up to about $${cap} over the first weeks.`,
        second: (n, ch) => `Return to ${n} on ${ch} weekly with a different task each time, so the usage is a habit and not a single call.`,
        noun: 'service call',
        presence: genericPresence('use'),
      };
    case 'Decentralized BTC':
    case 'Anchor BTC':
      return {
        core: (n, ch, cap) => `Deposit about $${cap} of a Bitcoin-side asset through ${n} on ${ch} and keep the position open.`,
        second: (n, ch) => `Withdraw a small part of the ${n} position on ${ch} once to prove the route back, then deposit it again.`,
        noun: 'deposit',
        presence: genericPresence('deposit'),
      };
    case 'Token Locker':
      return {
        core: (n, ch, cap) => `Lock a small position — about $${cap} if it is yours to lock — through ${n} on ${ch} for a full quarter.`,
        second: (n, ch) => `Extend the ${n} lock on ${ch} once before it expires, so the wallet shows a continuing locker user.`,
        noun: 'lock',
        presence: genericPresence('lock'),
      };
    case 'NFT Marketplace':
      return {
        core: (n, ch, cap) => `Buy one inexpensive item on ${n} on ${ch}, up to about $${cap}, from a collection with real trading history.`,
        second: (n, ch) => `List an item for sale on ${n} on ${ch} at a fair price and leave the listing up for at least a week.`,
        noun: 'trade',
        presence: genericPresence('trade'),
      };
    case 'Governance Incentives':
      return {
        core: (n, ch, cap) => `If ${n}'s interface publishes steps for an incentive program, follow them on ${ch} with about $${cap} of qualifying activity; if it publishes none, make a first ordinary use of the product instead.`,
        second: (n, ch) => `Vote in one ${n} governance decision on ${ch} if the interface offers one, and keep the qualifying position open meanwhile.`,
        noun: 'participation',
        presence: genericPresence('participate'),
      };
    default:
      return {
        core: (n, ch, cap) => `Open ${n} on ${ch} and make a first real use of its ${c ? c.toLowerCase() : 'core'} product with about $${cap}, following its own interface end to end.`,
        second: (n, ch) => `Return to ${n} on ${ch} within the week and repeat the core action at a smaller size, so the first use is not the only one.`,
        noun: 'use',
        presence: genericPresence('use'),
      };
  }
}

/** A deterministic per-protocol hash, used to rotate the templated steps. */
function slugHash(slug: string): number {
  return [...slug].reduce((a, ch) => a + ch.charCodeAt(0), 0);
}

/**
 * The presence step in four rotating forms, picked by slug hash so neighbouring rows do not
 * read identically: the playbook's own form, then three generic conditional forms. Every form
 * stays conditional — none asserts that a forum, a program or a list exists.
 */
function presenceStep(play: Play, name: string, hash: number): string {
  const variants: (() => string)[] = [
    () => play.presence(name),
    () => `Look for a way to be counted by ${name} beyond the product itself — a forum, a testnet, a waitlist, a feedback form — and use whichever one its interface actually offers.`,
    () => `Check whether ${name} keeps a community channel, a governance vote or an early-access list, and join the one that exists; if none does, a public post about your use is the record instead.`,
    () => `Spend one session on ${name}'s public side: read its announcements, answer any call for testers it has made, and keep the same wallet visible across what you join.`,
  ];
  return variants[hash % variants.length]!();
}

/** The three rotating closing steps: the plan's honesty, in the snapshot's own language. */
const HONESTY_STEPS = [
  (n: string) => `Nothing in the snapshot promises ${n} a token or an airdrop; this is positioning, not a guarantee — re-check the protocol's record before committing more.`,
  (n: string) => `${n} records no token in the snapshot, and none may ever come; farm it only while using the product itself stays worthwhile on its own terms.`,
  (n: string) => `Treat any ${n} launch as unconfirmed until the protocol announces it itself; never pay a third party who offers to claim a reward on your behalf.`,
];

/** A step as one string: its action, then its cost and time, held to the design's 60..300 characters. */
function stepText(action: string, cost: string, time: string): string {
  let s = `${action} Cost: ${cost}. Time: ${time}.`;
  if (s.length > 300) s = `${s.slice(0, 296)}...`;
  return s;
}

/**
 * A protocol's farm plan: six steps from its category's playbook, with slots filled from its own
 * record — its name, its real chains, its TVL's capital band, its age's holding period. Every step
 * names the protocol; none invents a program, a fee, an APY or a date.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const play = playFor(p.category);
  const hash = slugHash(p.slug);
  const name = p.name;
  const chain1 = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const chain2 = p.chains.length > 1 ? p.chains[1]! : null;
  const cap = capitalFor(p);
  const gas = cap >= 150 ? 8 : 4;
  const hold = holdDaysFor(age);
  const steps: string[] = [
    stepText(play.core(name, chain1, cap), `about $${gas} of gas plus the $${cap} position`, '15 minutes to set up'),
    stepText(play.second(name, chain1, cap), 'about $2 of gas', '20 minutes'),
    chain2 !== null
      ? stepText(
          `Repeat the ${play.noun} on ${chain2}, ${name}'s second chain, so the wallet's activity is not tied to one network.`,
          'about $3 of gas',
          '10 minutes',
        )
      : stepText(
          `Deepen the ${name} position on ${chain1}: add a second, smaller ${play.noun} so the wallet shows more than a single visit.`,
          'about $2 of gas',
          '10 minutes',
        ),
    stepText(
      `Return to ${name} once a week for at least ${hold} days, repeating the ${play.noun} on ${chain1} in small amounts rather than one large visit.`,
      'about $2 of gas a week',
      `${hold} days, 10 minutes a week`,
    ),
    stepText(presenceStep(play, name, hash), 'nothing but the time', '20 minutes'),
    stepText(HONESTY_STEPS[hash % HONESTY_STEPS.length]!(name), 'nothing', '5 minutes to re-check'),
  ];
  return steps;
}

// ------------------------------------------------------------------ assembly

/** A board row's compact form for data.js: the same figures, the same plan. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    provenance: row.provenance,
    multiple: row.model.multiple,
    multiple_pre_thin: row.model.multiple_pre_thin,
    thin_capped: row.model.thin_capped,
    sparse: row.model.sparse,
    sparse_peers: row.model.sparse_peers,
    peer_median: row.model.peer_median,
    peer_count: row.model.peer_count,
    f_mom: row.model.f_mom,
    f_chain: row.model.f_chain,
    f_age: row.model.f_age,
    multiple_ceiling: row.model.multiple_ceiling,
    multiple_uncapped: row.model.multiple_uncapped,
    multiple_effective: row.model.multiple_effective,
    multiple_capped: row.model.multiple_capped,
    band_low_usd: row.model.band_low_usd,
    band_high_usd: row.model.band_high_usd,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const peers = buildPeerBook(snapshot, model);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    protocol_count: snapshot.protocols.length,
    tokenless_count: snapshot.protocols.filter(isPreToken).length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    global_median: round4(peers.global_median),
    global_q25: round4(peers.global_q25),
    global_q75: round4(peers.global_q75),
    multiple_ceiling: peers.multiple_ceiling,
    rows: board.map(radarRow),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/**
 * Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied
 * value, farm-step bounds (the gate's 20..600 and the design's tighter 60..300), and positive
 * whole implied values under the cap.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the gate's 100`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 60 || t.length > 300) return `${r.slug} has a farm step of ${t.length} characters, outside the design's 60..300`;
      if (!t.includes(r.name)) return `${r.slug} has a farm step that never names the protocol`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
