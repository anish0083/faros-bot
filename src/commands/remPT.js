const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { getPtConfig, createPtPending, getLogChannelId } = require('../utils/pointsDatabase');

function parseMentions(str) {
  return [...str.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rempt')
    .setDescription('Remove points from one or more users.')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Points to remove (per user). Points floor at 0.')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(opt =>
      opt.setName('users')
        .setDescription('@mention one or more users separated by spaces.')
        .setRequired(true)
    ),

  async execute(interaction) {
    const config = await getPtConfig(interaction.guildId);
    if (!config) {
      await interaction.reply({ content: '❌ Points system not configured. Ask an admin to run `/pt-config`.', flags: MessageFlags.Ephemeral });
      return;
    }

    const hasModRole = interaction.member.roles.cache.has(config.mod_role_id);
    const isAdmin = interaction.memberPermissions.has(8n);
    if (!hasModRole && !isAdmin) {
      await interaction.reply({ content: `❌ You need the <@&${config.mod_role_id}> role to use this command.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const amount = interaction.options.getInteger('amount');
    const usersStr = interaction.options.getString('users');
    const userIds = parseMentions(usersStr);

    if (!userIds.length) {
      await interaction.reply({ content: '❌ No valid @mentions found. Mention at least one user.', flags: MessageFlags.Ephemeral });
      return;
    }

    const uuid = await createPtPending(interaction.guildId, interaction.user.id, userIds, -amount);

    const userMentions = userIds.map(id => `<@${id}>`).join(', ');

    // Public live notification in the channel where command was used
    await interaction.channel.send({
      content: `⏳ **<@${interaction.user.id}> is removing \`${amount} pts\`** from ${userMentions} — waiting for reason & confirmation...`,
    });

    // Notify log channel (if set and different from current channel)
    try {
      const logChannelId = await getLogChannelId(interaction.guildId);
      if (logChannelId && logChannelId !== interaction.channel.id) {
        const logChannel = await interaction.guild.channels.fetch(logChannelId);
        if (logChannel) {
          await logChannel.send({
            content: `📋 **Points action initiated** | <@${interaction.user.id}> is removing \`${amount} pts\` from ${userMentions} in <#${interaction.channel.id}> — pending confirmation`,
          });
        }
      }
    } catch { /* log channel inaccessible — skip */ }

    const modal = new ModalBuilder()
      .setCustomId(`pt_reason_modal:${uuid}`)
      .setTitle(`Remove ${amount} pts from ${userIds.length} user${userIds.length > 1 ? 's' : ''}`);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('pt_reason_input')
          .setLabel('Reason')
          .setPlaceholder('Why are you removing these points?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
      )
    );

    await interaction.showModal(modal);
  },
};
