const { PermissionFlagsBits, ActionRowBuilder, RoleSelectMenuBuilder } = require('discord.js');
const { setGuildRole } = require('./database');
const { CHAIN, NFT, explorerAddressLink } = require('../config/chain');

const ROLE_SELECT_ID = 'config_role_select';

function buildRoleSelect() {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(ROLE_SELECT_ID)
      .setPlaceholder('Pick the role to grant verified holders')
      .setMinValues(1)
      .setMaxValues(1)
  );
}

async function applyRole(interaction, role) {
  if (role.managed) {
    return `❌ <@&${role.id}> is managed by an integration and cannot be assigned manually. Create a normal role instead.`;
  }

  if (role.id === interaction.guild.id) {
    return '❌ `@everyone` cannot be used as the holder role.';
  }

  const me = await interaction.guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return '❌ The bot is missing the **Manage Roles** permission. Grant it and try again.';
  }
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return (
      `❌ <@&${role.id}> is above or equal to the bot's highest role (<@&${me.roles.highest.id}>).\n` +
      'Move the bot\'s role **above** it in Server Settings → Roles.'
    );
  }

  await setGuildRole(interaction.guildId, role.id);
  console.log(`[Config] Guild ${interaction.guildId} (${interaction.guild.name}) → role ${role.id} by ${interaction.user.tag}`);

  return (
    '✅ **Configuration saved!**\n\n' +
    `**Role:** <@&${role.id}>\n` +
    `**Chain:** ${CHAIN.name}\n` +
    `**Collection:** ${NFT.name} — ${explorerAddressLink(NFT.address)}\n\n` +
    'Now run `/setupnft` in the channel where you want the claim button.'
  );
}

module.exports = { ROLE_SELECT_ID, buildRoleSelect, applyRole };
