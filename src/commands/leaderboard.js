const { SlashCommandBuilder } = require('discord.js');
const { buildLeaderboardEmbed } = require('../handlers/ptConfirm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top 10 points leaderboard.'),

  async execute(interaction) {
    await interaction.deferReply();
    const embed = await buildLeaderboardEmbed(interaction.guild, interaction.guildId);
    await interaction.editReply({ embeds: [embed] });
  },
};
