const { SlashCommandBuilder } = require('discord.js');
const { buildLeaderboardPage, buildButtons } = require('../handlers/leaderboardNav');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the full points leaderboard (paginated) with CSV export.'),

  async execute(interaction) {
    await interaction.deferReply();

    const { embed, page, totalPages } = await buildLeaderboardPage(interaction.guild, interaction.guildId, 0);
    const row = buildButtons(page, totalPages);

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
