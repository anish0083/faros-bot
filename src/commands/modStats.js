const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getModStats } = require('../utils/pointsDatabase');

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod-stats')
    .setDescription('Show mod points activity ranked by distributed points.'),

  async execute(interaction) {
    await interaction.deferReply();

    const rows = await getModStats(interaction.guildId, 10);

    if (!rows.length) {
      await interaction.editReply({ content: 'No points have been distributed yet.' });
      return;
    }

    const lines = await Promise.all(rows.map(async (row, i) => {
      let name;
      try {
        const member = await interaction.guild.members.fetch(row.mod_discord_id);
        name = member.displayName;
      } catch {
        name = `Unknown (${row.mod_discord_id.slice(-4)})`;
      }
      const medal = RANK_MEDALS[i] ?? `${i + 1}.`;
      const distributed = Number(row.total_distributed);
      const removed     = Number(row.total_removed);
      return `${medal} **${name}**\n┣ 📤 Distributed: **${distributed} pts**\n┗ 📥 Removed: **${removed} pts**`;
    }));

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Mod Activity Stats')
      .setDescription(lines.join('\n\n'))
      .setColor(0xFFA500)
      .setFooter({ text: 'Ranked by points distributed' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
