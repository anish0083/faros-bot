const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = async function handleClaimButton(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('claim_role_modal')
    .setTitle('NFT Role Verification');

  const addressInput = new TextInputBuilder()
    .setCustomId('eth_address_input')
    .setLabel('Your Wallet Address')
    .setPlaceholder('0x1234567890abcdef1234567890abcdef12345678')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(42)
    .setMaxLength(42);

  modal.addComponents(new ActionRowBuilder().addComponents(addressInput));

  await interaction.showModal(modal);
};
