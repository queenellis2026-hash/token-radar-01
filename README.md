[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/queenellis2026-hash/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/queenellis2026-hash/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token launch radar

A token launch radar built for make.fun's [token-radar-01 bounty](https://make.fun/bounty/token-radar-01):
it reads a sealed DefiLlama snapshot (758 protocols, frozen 2026-11-14) and ranks the protocols that
record no token by an implied token-launch value, each with a concrete farm plan.

## Method

For each category, the model takes the winsorized (1st–99th percentile) median market-cap/TVL multiple
of the category's tokenized protocols, shrunk toward the global median (k=8), then adjusts for 7-day TVL
momentum, chain breadth, and seasoning, rounding to 3 significant figures. Two disclosed guards keep
thin evidence from producing absurd headlines: categories with at most 2 tokenized peers have their
multiple capped at 1.5× the global median, and every row's effective multiple is capped at the 90th
percentile of all tokenized peer multiples (×2.163). Wrapped, staked, bridged and exchange products are
screened out; every watchlist protocol is carried in whole. Every row's detail page prints the full
factor arithmetic, its peer evidence, and an in-page recompute that reproduces the board's number —
nothing is priced off a hardcoded list of names.

## Run it

```sh
node main.ts
```

Node 22. The program reads `/input/snapshot.json` (overridable via `MAKEFUN_INPUT_DIR`) and writes
`board.json`, a static `dashboard/`, `screenshots/`, and `dossier.json` to `/output`
(overridable via `MAKEFUN_OUTPUT_DIR`). No dependencies, no network.
