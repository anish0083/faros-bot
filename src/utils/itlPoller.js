const { EXPLORER_API } = require('../config/chain');
const {
  getActivePendingClaims,
  deletePendingClaim,
  popExpiredPendingClaims,
  hasUserItlClaimed,
  recordItlClaim,
  incrementStrike,
  setUserTimeout,
} = require('./itlDatabase');

const CHAD_QUOTES = [
  '"Winners verify their wallets. Losers miss deadlines." 📉',
  '"Your wallet address is not the problem. Your discipline is." 💀',
  '"Ser, even a broke L1 validator processes transactions faster than this." 🗿',
  '"Verification window: 15 minutes. Your attention span: apparently less." ⏰',
  '"Skill issue. Touch grass and try again." 🌿',
  '"The blockchain waited. You didn\'t." ⛓️',
  '"Not your keys? At least be your own alarm clock." 😤',
  '"Ngmi." 💔',
  '"Bro couldn\'t send one transaction in 15 minutes. Incredible." 🤡',
  '"Even a cold wallet moves faster than you." 🧊',
];

function randomChadQuote() {
  return CHAD_QUOTES[Math.floor(Math.random() * CHAD_QUOTES.length)];
}

async function fetchInboundTxs(paymentWallet) {
  const params = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address: paymentWallet,
    sort: 'desc',
    page: '1',
    offset: '100',
  });

  try {
    const res = await fetch(`${EXPLORER_API.baseUrl}/api?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(EXPLORER_API.timeoutMs),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.result)) return [];
    return data.result.filter(tx =>
      tx.to?.toLowerCase() === paymentWallet.toLowerCase() && tx.isError === '0'
    );
  } catch {
    return [];
  }
}

async function processExpiredClaims(client) {
  const expired = await popExpiredPendingClaims();
  if (!expired.length) return;

  for (const claim of expired) {
    const strikes = await incrementStrike(claim.guild_id, claim.discord_user_id);

    let dmContent;
    if (strikes >= 5) {
      const timeoutUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await setUserTimeout(claim.guild_id, claim.discord_user_id, timeoutUntil);
      dmContent =
        `🚫 **You've been timed out for 3 days.**\n\n` +
        `You failed wallet verification **5 times** in a row.\n` +
        `Come back <t:${Math.floor(timeoutUntil.getTime() / 1000)}:R>.\n\n` +
        randomChadQuote();
    } else {
      const remaining = 5 - strikes;
      dmContent =
        `⚠️ **Wallet verification failed** — transaction not detected in time.\n\n` +
        `${randomChadQuote()}\n\n` +
        `You have **${remaining} attempt${remaining !== 1 ? 's' : ''}** left before a 3-day timeout.\n` +
        `Click the button again to retry.`;
    }

    try {
      const guild = await client.guilds.fetch(claim.guild_id);
      const member = await guild.members.fetch(claim.discord_user_id);
      await member.send(dmContent);
    } catch {
      // DMs disabled or member left — not critical
    }

    console.log(`[ITL Poller] Claim expired | Guild: ${claim.guild_id} | User: ${claim.discord_user_id} | Strikes: ${strikes}`);
  }
}

async function checkActiveClaims(client) {
  const pending = await getActivePendingClaims();
  if (!pending.length) return;

  const byWallet = new Map();
  for (const claim of pending) {
    const key = claim.payment_wallet.toLowerCase();
    if (!byWallet.has(key)) byWallet.set(key, []);
    byWallet.get(key).push(claim);
  }

  for (const [, claims] of byWallet) {
    const paymentWallet = claims[0].payment_wallet;
    const inboundTxs = await fetchInboundTxs(paymentWallet);
    if (!inboundTxs.length) continue;

    for (const claim of claims) {
      const claimCreatedTs = Math.floor(new Date(claim.created_at).getTime() / 1000);

      const matched = inboundTxs.some(tx =>
        tx.from?.toLowerCase() === claim.wallet_address.toLowerCase() &&
        Number(tx.timeStamp) >= claimCreatedTs
      );

      if (!matched) continue;

      if (await hasUserItlClaimed(claim.guild_id, claim.discord_user_id)) {
        await deletePendingClaim(claim.id);
        continue;
      }

      let member = null;
      try {
        const guild = await client.guilds.fetch(claim.guild_id);
        member = await guild.members.fetch(claim.discord_user_id);
        await member.roles.add(claim.role_id);
        console.log(`[ITL Poller] Role granted | Guild: ${claim.guild_id} | User: ${claim.discord_user_id} | Wallet: ${claim.wallet_address}`);
      } catch (err) {
        console.error(`[ITL Poller] Role grant failed | Guild: ${claim.guild_id} | User: ${claim.discord_user_id}:`, err.message);
      }

      await recordItlClaim(claim.guild_id, claim.discord_user_id, claim.wallet_address);
      await deletePendingClaim(claim.id);

      if (member) {
        try {
          await member.send(
            `✅ **Wallet verification complete!**\n\n` +
            `Your wallet \`${claim.wallet_address}\` has been verified and you've been granted your role. Welcome!`
          );
        } catch {
          // DMs disabled — role was still granted
        }
      }
    }
  }
}

async function pollOnce(client) {
  await processExpiredClaims(client);
  await checkActiveClaims(client);
}

function startItlPoller(client) {
  setInterval(() => {
    pollOnce(client).catch(err => console.error('[ITL Poller] Poll error:', err.message));
  }, 15_000);
  console.log('[ITL Poller] Started (15s interval)');
}

module.exports = { startItlPoller };
