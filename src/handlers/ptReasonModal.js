const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getPtPending, setPtPendingReason } = require('../utils/pointsDatabase');

module.exports = async function handlePtReasonModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const uuid = interaction.customId.replace('pt_reason_modal:', '');
  const reason = interaction.fields.getTextInputValue('pt_reason_input').trim();

  const pending = await getPtPending(uuid);
  if (!pending) {
    await interaction.editReply({ content: '❌ This session expired. Run the command again.' });
    return;
  }

  await setPtPendingReason(uuid, reason);

  const userIds = pending.user_ids.split(',').filter(Boolean);
  const isAdd = pending.delta > 0;
  const amount = Math.abs(pending.delta);

  const userLines = userIds.map(id => `<@${id}>`).join(', ');

  const embed = new EmbedBuilder()
    .setTitle(isAdd ? '➕ Add Points — Review' : '➖ Remove Points — Review')
    .setColor(isAdd ? 0x00C853 : 0xFF4500)
    .addFields(
      { name: 'Users', value: userLines, inline: false },
      { name: isAdd ? 'Points to Add' : 'Points to Remove', value: `**${amount} pts** each`, inline: true },
      { name: 'Total Users', value: `${userIds.length}`, inline: true },
      { name: 'Reason', value: reason, inline: false },
    )
    .setFooter({ text: `Requested by ${interaction.user.username}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pt_confirm:${uuid}`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`pt_cancel:${uuid}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
};
