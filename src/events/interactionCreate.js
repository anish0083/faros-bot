const { MessageFlags } = require('discord.js');
const handleClaimButton    = require('../handlers/claimButton');
const handleClaimModal     = require('../handlers/claimModal');
const handleRoleSelect     = require('../handlers/roleSelect');
const { ROLE_SELECT_ID }   = require('../utils/roleSetup');
const handleItlClaimButton = require('../handlers/itlClaimButton');
const handleItlClaimModal  = require('../handlers/itlClaimModal');
const handlePtReasonModal  = require('../handlers/ptReasonModal');
const handlePtConfirm      = require('../handlers/ptConfirm');
const handleModStatsNav    = require('../handlers/modStatsNav');
const handleLeaderboardNav = require('../handlers/leaderboardNav');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {
    try {
      console.log(
        `[Discord] Interaction received: ${interaction.type} ${interaction.commandName || interaction.customId || ''}`
      );

      const originalDefer = interaction.deferReply.bind(interaction);
      interaction.deferReply = async function deferReplySafe(options) {
        if (interaction.deferred || interaction.replied) return interaction;
        return originalDefer(options);
      };
      const originalReply = interaction.reply.bind(interaction);
      interaction.reply = async function replySafe(options) {
        if (interaction.deferred && !interaction.replied) return interaction.editReply(options);
        return originalReply(options);
      };

      if (!client.dbReady) {
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: '⏳ Bot is still starting up. Try the command again in a few seconds.',
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
          return;
        }
        await command.execute(interaction);
        return;
      }

      if (interaction.isRoleSelectMenu()) {
        if (interaction.customId === ROLE_SELECT_ID) await handleRoleSelect(interaction);
        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId === 'claim_role_button') await handleClaimButton(interaction);
        if (interaction.customId === 'itl_claim_button')  await handleItlClaimButton(interaction);
        if (interaction.customId.startsWith('pt_confirm:') ||
            interaction.customId.startsWith('pt_cancel:')  ||
            interaction.customId === 'pt_reset_confirm'     ||
            interaction.customId === 'pt_reset_cancel')      await handlePtConfirm(interaction);
        if (interaction.customId.startsWith('ms_page:') ||
            interaction.customId === 'ms_export')            await handleModStatsNav(interaction);
        if (interaction.customId.startsWith('lb_page:') ||
            interaction.customId === 'lb_export')            await handleLeaderboardNav(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'claim_role_modal') await handleClaimModal(interaction);
        if (interaction.customId === 'itl_claim_modal')  await handleItlClaimModal(interaction);
        if (interaction.customId.startsWith('pt_reason_modal:')) await handlePtReasonModal(interaction);
        return;
      }
    } catch (error) {
      console.error('[InteractionCreate]', error);
      try {
        const msg = { content: '❌ Something went wrong. Please try again.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      } catch {
        return;
      }
    }
  },
};
