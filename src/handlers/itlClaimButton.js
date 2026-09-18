const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = async function handleItlClaimButton(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('itl_claim_modal')
    .setTitle('Wallet Verification');

  const addressInput = new TextInputBuilder()
    .setCustomId('itl_wallet_input')
    .setLabel('Your Wallet Address')
    .setPlaceholder('0x1234567890abcdef1234567890abcdef12345678')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(42)
    .setMaxLength(42);

  modal.addComponents(new ActionRowBuilder().addComponents(addressInput));

  await interaction.showModal(modal);
};
