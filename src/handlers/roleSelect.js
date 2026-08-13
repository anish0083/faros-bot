const { MessageFlags } = require('discord.js');
const { applyRole } = require('../utils/roleSetup');

module.exports = async function handleRoleSelect(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const role = interaction.roles.first();
  if (!role) {
    await interaction.editReply({ content: '❌ No role was selected. Run the command again.' });
    return;
  }

  await interaction.editReply({ content: await applyRole(interaction, role) });
};
