const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { getGuildRole, setGuildRole } = require('../utils/database');
const { CHAIN, NFT, explorerAddressLink, chainFooter } = require('../config/chain');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Faros Bot for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role to grant verified NFT holders (leave empty to view current config)')
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
      if (role.managed) {
        await interaction.editReply({
          content: `❌ <@&${role.id}> is managed by an integration and cannot be assigned manually. Create a normal role instead.`,
        });
        return;
      }

      if (role.id === interaction.guild.id) {
        await interaction.editReply({ content: '❌ `@everyone` cannot be used as the holder role.' });
        return;
      }

      const me = await interaction.guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.editReply({ content: '❌ The bot is missing the **Manage Roles** permission. Grant it and try again.' });
        return;
      }
      if (me.roles.highest.comparePositionTo(role) <= 0) {
        await interaction.editReply({
          content:
            `❌ <@&${role.id}> is above or equal to the bot's highest role (<@&${me.roles.highest.id}>).\n` +
            'Move the bot\'s role **above** it in Server Settings → Roles.',
        });
        return;
      }

      await setGuildRole(interaction.guildId, role.id);

      await interaction.editReply({
        content:
          '✅ **Configuration saved!**\n\n' +
          `**Role:** <@&${role.id}>\n` +
          `**Chain:** ${CHAIN.name}\n` +
          `**Collection:** ${NFT.name} — ${explorerAddressLink(NFT.address)}\n\n` +
          'Now run `/setupnft` in the channel where you want the claim button.',
      });

      console.log(`[Config] Guild ${interaction.guildId} (${interaction.guild.name}) → role ${role.id} by ${interaction.user.tag}`);
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
        'To change the role, run `/config role:@YourRole`.'
      );
    } else {
      embed.setDescription(
        '❌ **This server is not configured yet.**\n\n' +
        'Run `/config role:@YourRole` to set it up, or `/config role_id:123456789012345678` if you would rather paste the ID.\n\n' +
        'The chain and NFT contract are already built into the bot — you only need to choose the role.\n' +
        'Make sure the bot has **Manage Roles** and that its role sits **above** the target role.'
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
