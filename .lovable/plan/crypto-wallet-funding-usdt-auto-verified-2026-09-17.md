# Crypto wallet funding (USDT), auto-verified

Let people fund their Oventric wallet with USDT and have the wallet credited automatically once the payment is confirmed on the blockchain — no screenshots, no manual admin approval.

## What the buyer sees

1. On **Add funds**, "USDT (TRC20)" stops being "Soon".
2. They enter an amount in their own currency; we show the exact USDT figure to send, locked for 30 minutes at the rate we quote.
3. We show a payment address plus a QR code and a live countdown.
4. Once the payment lands and has enough network confirmations, the page flips to "Funded" on its own and the wallet balance updates.
5. If they send too little, too much, or after the window expires, the deposit is flagged and shown as "Needs review" with a support link, rather than silently lost.

## What we will not build

Binance or Bybit **User ID** transfers. Those never touch the blockchain, and neither exchange gives a merchant a way to confirm that a given user sent money by ID — it would always end in a human checking screenshots, which is exactly the manual risk we retired with MiniPay. Only chain payments to an address we control can be verified.

## Recommended approach: crypto payment provider

Use a crypto payment processor (NOWPayments or a comparable provider) rather than holding keys ourselves:

- The provider issues a one-time deposit address per payment, watches the chain, and calls a signed webhook when the payment is confirmed.
- We never custody private keys, never run a chain-watching job, and never have to handle network re-orgs.
- It settles into a balance we can withdraw, the same way the card gateway does.

This needs one API key and one webhook secret stored as backend secrets. I will request them when we get there.

The alternative — generating our own TRON addresses and polling an explorer — means holding private keys and sweeping funds ourselves. I do not recommend it for this stage.

## Technical details

**Database** — new `crypto_deposits` table: user, currency and amount requested, quoted USDT amount, FX snapshot, provider payment id (unique), deposit address, status (`awaiting_payment`, `confirming`, `credited`, `underpaid`, `expired`, `failed`), expires_at, credited reference. GRANTs plus RLS so a user can read only their own rows; all writes are backend-only. The credit reference reuses the existing unique-by-reference money-entry rule, so a repeated webhook can never credit twice.

**Server functions** (`src/lib/crypto-funding.functions.ts`, authenticated):
- `createCryptoDeposit` — validates the amount, quotes the USDT figure server-side (never trusting a browser number), creates the provider payment, stores the row, returns address, amount and expiry.
- `getCryptoDeposit` — polled by the page for live status.

**Webhook** — `src/routes/api/public/crypto-webhook.ts`: verifies the provider's HMAC signature before reading the body, matches the payment id, re-checks the received amount against the quote, and on confirmation calls the existing `settleWalletTopup` path with a deterministic reference. Underpayments and overpayments are recorded, not credited, and surface in admin.

**Admin** — the new deposits appear in the existing wallet funding and ledger views; a small `Crypto deposits` filter with status so finance can see anything stuck in `underpaid` or `expired`. Detection only, no manual crediting button, in line with the current financial rules.

**UI** — `AddCapitalModal` gets a USDT branch: quote step, then a payment panel (address, copy button, QR, countdown, live status) in the same white wallet styling. Card and bank transfer flows are untouched.

**Untouched**: 80/20 settlement, cashback, escrow, refunds, the Paystack routing, and every existing money path. Crypto funding is only a new way to reach the same wallet-credit function.

## Before I build

I will need the provider account, its API key and webhook secret. Everything else can be built and tested against the provider's sandbox with no real money.
