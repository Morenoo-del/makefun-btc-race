# Dip-Reversion BTC Bot — btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Morenoo-del/makefun-btc-race/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Morenoo-del/makefun-btc-race/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A bot that trades cbBTC/USDC on 1-minute bars in the
`agent-fun/bars-replay/v1` replay for the make.fun competition
`btc-race-24h-20261117-0603`.

## Strategy

On this market the 1-minute price whipsaws around a slow 4-hour mean,
while a full round trip costs about 26 bps in fees, slippage and price
impact. So the bot only trades large, slow deviations from that mean:

- **Buy** the full cash balance when a bar's close is at least 0.40%
  below the mean of the previous 240 closes.
- **Sell** the whole position when a close recovers to at least 0.40%
  above that same mean.
- **Stop-loss:** sell if the close falls 1% below the close the buy
  was decided on, so a dip that keeps falling is cut instead of held.
  After a stop-loss sale the bot waits 30 bars before buying again.

That is 3–6 trades per 24 hours on the dev window, each one sized to
clear the round-trip cost with room to spare. The bot is long-only,
uses no leverage, never shorts, and holds at most one position.

## Files

- `main.ts` — the bot (Node 22, erasable TypeScript, standard library
  plus the vendored shim). It reads one `hello`, then one `batch` per
  minute, and answers each batch with exactly one reply echoing its
  `seq`, carrying at most one order. Orders decided on a batch fill at
  the next bar's open. Fully deterministic: no randomness, no wall
  clock, no environment, no files outside its own directory.
- `vendor/makefun-bars.ts` — the kit's protocol shim, copied byte for
  byte from the competition kit.
- `LICENSE` — MIT.

## Dev-window result

Graded locally with the kit (`grade-local`, process driver):

- Net PnL: **+$10.93 USDC** (target was > $0; comfortably positive)
- Trades: 6 (3 round trips), 0 rejected orders
- Max drawdown: 1.07%
- Fees paid: $2.42 USDC

## License

MIT — see `LICENSE`.
