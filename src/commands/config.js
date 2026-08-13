const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { getGuildRole } = require('../utils/database');
const { CHAIN, NFT, explorerAddressLink, chainFooter } = require('../config/chain');
const { buildRoleSelect, applyRole } = require('../utils/roleSetup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Faros Bot for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role to grant verified NFT holders (leave empty to pick from a menu)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('role_id')
        .setDescription('Role ID, if you prefer pasting it instead of picking the role')
        .setRequired(false)
        .setMinLength(17)
        .setMaxLength(20)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const roleId = interaction.options.getString('role_id');
    let role = interaction.options.getRole('role');

    if (!role && roleId) {
      if (!/^\d{17,20}$/.test(roleId.trim())) {
        await interaction.editReply({
          content:
            '❌ **Invalid Role ID.** It must be 17–20 digits.\n' +
            'Enable Discord Settings → Advanced → Developer Mode, then right-click the role → Copy Role ID.',
        });
        return;
      }

      role = await interaction.guild.roles.fetch(roleId.trim()).catch(() => null);
      if (!role) {
        await interaction.editReply({ content: `❌ **No role with ID \`${roleId.trim()}\`** exists in this server.` });
        return;
      }
    }

    if (role) {
      await interaction.editReply({ content: await applyRole(interaction, role) });
      return;
    }

    const config = await getGuildRole(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Faros Bot — Server Configuration')
      .setColor(config ? 0x00C853 : 0xFF4500)
      .addFields(
        { name: 'Chain', value: CHAIN.name, inline: true },
        { name: 'Collection', value: NFT.name, inline: true },
        { name: 'Contract', value: explorerAddressLink(NFT.address) },
      )
      .setFooter({ text: `${chainFooter()} • Server ID: ${interaction.guildId}` });

    if (config) {
      embed.setDescription(
        '✅ **This server is configured.**\n\n' +
        `**Role:** <@&${config.role_id}>\n` +
        `**Last configured:** ${new Date(config.configured_at).toUTCString()}\n\n` +
        'Pick a different role from the menu below to change it.'
      );
    } else {
      embed.setDescription(
        '❌ **This server is not configured yet.**\n\n' +
        'Pick the holder role from the menu below.\n\n' +
        'The chain and NFT contract are already built into the bot — you only need to choose the role.\n' +
        'Make sure the bot has **Manage Roles** and that its role sits **above** the target role.'
      );
    }

    await interaction.editReply({ embeds: [embed], components: [buildRoleSelect()] });
  },
};
