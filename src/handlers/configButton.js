const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = async function handleConfigButton(interaction) {
  // showModal() must be the FIRST response — no async DB calls before this
  const modal = new ModalBuilder()
    .setCustomId('server_config_modal')
    .setTitle('Faros Bot — Server Config');

  const contractInput = new TextInputBuilder()
    .setCustomId('config_contract')
    .setLabel('NFT Contract Address')
    .setPlaceholder('0x1234567890abcdef1234567890abcdef12345678')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(42)
    .setMaxLength(42);

  const rpcInput = new TextInputBuilder()
    .setCustomId('config_rpc')
    .setLabel('RPC URL')
    .setPlaceholder('https://liteforge.rpc.caldera.xyz/http')
    .setValue('https://liteforge.rpc.caldera.xyz/http')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const roleInput = new TextInputBuilder()
    .setCustomId('config_role')
    .setLabel('Role ID (right-click role → Copy Role ID)')
    .setPlaceholder('1234567890123456789')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(17)
    .setMaxLength(20);

  modal.addComponents(
    new ActionRowBuilder().addComponents(contractInput),
    new ActionRowBuilder().addComponents(rpcInput),
    new ActionRowBuilder().addComponents(roleInput),
  );

  await interaction.showModal(modal);
};
