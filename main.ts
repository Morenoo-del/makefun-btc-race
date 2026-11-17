// Dip-reversion bot for cbBTC/USDC on 1-minute bars.
//
// Idea: on this market the 1-minute price whipsaws around a slow
// 4-hour mean, while a full round trip costs about 26 bps in fees,
// slippage and impact. So the bot only trades large, slow deviations:
// it buys the whole cash balance when the latest bar close sits at
// least 0.40% below the mean of the previous 240 closes, and it sells
// the whole position when the close recovers to at least 0.40% above
// that same mean. A 1% stop below the entry close caps the loss if a
// dip keeps falling instead of reverting, and a 30-bar cooldown after
// a stop keeps the bot from buying straight back into a falling market.
// Few trades, each one sized to clear the round-trip cost with room
// to spare.
//
// The bot speaks agent-fun/bars-replay/v1 through the vendored shim:
// hello arrives once, then one batch per minute, and this bot answers
// each batch with exactly one reply echoing its seq, carrying at most
// one order. Orders decided on a batch fill at the next bar's open,
// so every decision here uses only closes already seen. The bot is
// fully deterministic: no randomness, no wall clock, no environment,
// no files outside its own directory.

import { runBars } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";

// How many past closes make up the slow mean (240 minutes = 4 hours).
const LOOKBACK = 240;
// Entry/exit bands around the mean, in basis points (40 bps = 0.40%).
const BAND_BPS = 40;
// Stop-loss below the close the buy was decided on, in basis points.
const STOP_BPS = 100;
// Largest move from the latest close a fill may suffer before the
// replay rejects it; wide enough for a normal minute, tight enough
// to refuse a fill after a violent jump.
const MAX_SLIP_BPS = 150;

// Closes already seen, oldest first. The slow mean is always taken
// over the closes before the bar being answered, never including it.
const closes: number[] = [];
// Close of the bar on which the current position's buy was decided.
// Zero while flat; used only for the stop-loss.
let entryClose = 0;
// Seq of the batch whose stop-loss sale was decided. After a stop the
// bot waits out a short cooldown before buying again, so it does not
// walk straight back into a market that is still falling.
let lastStopSeq = -1000;
const STOP_COOLDOWN_BARS = 30;

function slowMean(): number | null {
  if (closes.length < LOOKBACK) return null;
  let sum = 0;
  for (let i = closes.length - LOOKBACK; i < closes.length; i++) {
    sum += closes[i]!;
  }
  return sum / LOOKBACK;
}

await runBars({
  onBatch(state, batch) {
    if (state.warmingUp) return [];
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const scale = state.symbols.get(SYMBOL)?.price_scale ?? 5;
    const close = Number(bar.c) / 10 ** scale;

    const mean = slowMean();
    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;
    if (qty === 0n) entryClose = 0;

    let orders = [];
    if (mean !== null) {
      const lower = (mean * (10000 - BAND_BPS)) / 10000;
      const upper = (mean * (10000 + BAND_BPS)) / 10000;
      if (qty === 0n) {
        // Flat: buy the dip in full when the close is far below the mean,
        // unless a stop-loss sale just fired and the cooldown is running.
        if (
          close < lower &&
          state.cash > 0n &&
          state.seq - lastStopSeq >= STOP_COOLDOWN_BARS
        ) {
          entryClose = close;
          orders.push({
            side: "buy" as const,
            symbol: SYMBOL,
            notional_quote_units: state.cash,
            max_slippage_bps: MAX_SLIP_BPS,
          });
        }
      } else {
        // Long: take the reversion, or cut the loss at the stop.
        const stop = (entryClose * (10000 - STOP_BPS)) / 10000;
        const stopped = entryClose > 0 && close < stop;
        if (close > upper || stopped) {
          if (stopped) lastStopSeq = state.seq;
          orders.push({
            side: "sell" as const,
            symbol: SYMBOL,
            qty,
            max_slippage_bps: MAX_SLIP_BPS,
          });
        }
      }
    }

    closes.push(close);
    return orders;
  },
});
