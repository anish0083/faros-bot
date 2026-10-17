const { EmbedBuilder, MessageFlags } = require('discord.js');
const {
  getPtPending, deletePtPending, applyPoints, getLeaderboard,
  resetAllPoints, getLogChannelId,
} = require('../utils/pointsDatabase');

const RANK_MEDALS  = ['🥇', '🥈', '🥉'];
const RANK_COLORS  = [0xFFD700, 0xC0C0C0, 0xCD7F32];

async function buildLeaderboardEmbed(guild, guildId) {
  const rows = await getLeaderboard(guildId, 10);

  if (!rows.length) {
    return new EmbedBuilder()
      .setTitle('📊 Points Leaderboard')
      .setDescription('> No points awarded yet.\n> Use `/addpt` to get started!')
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
    const medal = RANK_MEDALS[i] ?? `\`${String(i + 1).padStart(2, ' ')}.\``;
    const bar = '█'.repeat(Math.min(10, Math.ceil(row.points / 10))) || '░';
    return `${medal} **${name}**\n┗ ${bar} **${row.points} pts**`;
  }));

  const topColor = RANK_COLORS[0] ?? 0x5865F2;

  return new EmbedBuilder()
    .setTitle('🏆 Points Leaderboard')
    .setDescription(lines.join('\n\n'))
    .setColor(topColor)
    .setFooter({ text: 'Top 10 Contributors' })
    .setTimestamp();
}

module.exports = async function handlePtConfirm(interaction) {
  // Handle reset buttons
  if (interaction.customId === 'pt_reset_confirm') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await resetAllPoints(interaction.guildId);
    await interaction.editReply({ content: '✅ All points and history have been reset to zero. Fresh start!' });
    return;
  }
  if (interaction.customId === 'pt_reset_cancel') {
    await interaction.reply({ content: '❌ Reset cancelled.', flags: MessageFlags.Ephemeral });
    return;
  }

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

  // Ephemeral confirmation to the mod
  await interaction.editReply({
    content: `✅ Done! ${isAdd ? 'Added' : 'Removed'} **${amount} pts** ${isAdd ? 'to' : 'from'} ${userLines}`,
  });

  // Public transparency message in the same channel
  const modMention = `<@${pending.mod_id}>`;
  const transparencyEmbed = new EmbedBuilder()
    .setColor(isAdd ? 0x00C853 : 0xFF4500)
    .setTitle(isAdd ? '📤 Points Distributed' : '📥 Points Removed')
    .addFields(
      { name: 'Mod', value: modMention, inline: true },
      { name: isAdd ? 'Distributed' : 'Removed', value: `**${amount} pts** each`, inline: true },
      { name: 'Users', value: userLines, inline: false },
      { name: 'Reason', value: pending.reason, inline: false },
    )
    .setTimestamp();

  await interaction.channel.send({ embeds: [transparencyEmbed] });

  // Log to log channel if set
  const logChannelId = await getLogChannelId(pending.guild_id);
  if (logChannelId && logChannelId !== interaction.channel.id) {
    try {
      const logChannel = await interaction.guild.channels.fetch(logChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(isAdd ? 0x00C853 : 0xFF4500)
          .setTitle(`📋 Points Log — ${isAdd ? 'Add' : 'Remove'}`)
          .addFields(
            { name: 'Mod', value: `${modMention} (${pending.mod_id})`, inline: true },
            { name: 'Action', value: isAdd ? `+${amount} pts` : `-${amount} pts`, inline: true },
            { name: 'Users', value: userLines, inline: false },
            { name: 'Reason', value: pending.reason, inline: false },
            { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch {
      // Log channel deleted or bot has no access — skip silently
    }
  }

  // Public leaderboard
  const leaderboardEmbed = await buildLeaderboardEmbed(interaction.guild, pending.guild_id);
  await interaction.channel.send({ embeds: [leaderboardEmbed] });
};

module.exports.buildLeaderboardEmbed = buildLeaderboardEmbed;
