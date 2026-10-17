const { EmbedBuilder, MessageFlags } = require('discord.js');
const {
  getPtPending, deletePtPending, applyPoints, getLeaderboard,
} = require('../utils/pointsDatabase');

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

async function buildLeaderboardEmbed(guild, guildId) {
  const rows = await getLeaderboard(guildId, 10);

  if (!rows.length) {
    return new EmbedBuilder()
      .setTitle('📊 Points Leaderboard')
      .setDescription('No points awarded yet.')
      .setColor(0x5865F2);
  }

  const lines = await Promise.all(rows.map(async (row, i) => {
    let name;
    try {
      const member = await guild.members.fetch(row.discord_user_id);
      name = member.displayName;
    } catch {
      name = `Unknown (${row.discord_user_id.slice(-4)})`;
    }
    const medal = RANK_MEDALS[i] ?? `${i + 1}.`;
    return `${medal}  **${name}** — ${row.points} pts`;
  }));

  return new EmbedBuilder()
    .setTitle('📊 Points Leaderboard')
    .setDescription(lines.join('\n'))
    .setColor(0x5865F2)
    .setTimestamp();
}

module.exports = async function handlePtConfirm(interaction) {
  const isConfirm = interaction.customId.startsWith('pt_confirm:');
  const uuid = interaction.customId.replace(/^pt_(confirm|cancel):/, '');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pending = await getPtPending(uuid);
  if (!pending) {
    await interaction.editReply({ content: '❌ This session expired or was already processed.' });
    return;
  }

  if (!isConfirm) {
    await deletePtPending(uuid);
    await interaction.editReply({ content: '❌ Cancelled.' });
    return;
  }

  const userIds = pending.user_ids.split(',').filter(Boolean);
  await applyPoints(pending.guild_id, pending.mod_id, userIds, pending.delta, pending.reason);
  await deletePtPending(uuid);

  const isAdd = pending.delta > 0;
  const amount = Math.abs(pending.delta);
  const userLines = userIds.map(id => `<@${id}>`).join(', ');

  const leaderboardEmbed = await buildLeaderboardEmbed(interaction.guild, pending.guild_id);

  await interaction.editReply({
    content:
      `✅ **${isAdd ? 'Added' : 'Removed'} ${amount} pts** ${isAdd ? 'to' : 'from'} ${userLines}\n` +
      `📝 Reason: ${pending.reason}`,
    embeds: [leaderboardEmbed],
  });
};

module.exports.buildLeaderboardEmbed = buildLeaderboardEmbed;
