const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getModStats } = require('../utils/pointsDatabase');

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod-stats')
    .setDescription('Show which mods have assigned the most points (ranked).'),

  async execute(interaction) {
    await interaction.deferReply();

    const rows = await getModStats(interaction.guildId, 10);

    if (!rows.length) {
      await interaction.editReply({ content: 'No points have been assigned yet.' });
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
      return `${medal}  **${name}** — ${row.total_assigned} pts assigned`;
    }));

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Mod Points Stats')
      .setDescription(lines.join('\n'))
      .setColor(0xFFA500)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
