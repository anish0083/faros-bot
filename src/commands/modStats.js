const { SlashCommandBuilder } = require('discord.js');
const { buildModStatsPage, buildButtons } = require('../handlers/modStatsNav');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod-stats')
    .setDescription('Show all mods\' points activity (paginated) with CSV export.'),

  async execute(interaction) {
    await interaction.deferReply();

    const { embed, page, totalPages } = await buildModStatsPage(interaction.guild, interaction.guildId, 0);
    const row = buildButtons(page, totalPages);

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
