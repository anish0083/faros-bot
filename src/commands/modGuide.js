const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod-guide')
    .setDescription('Post the mod guide for the points system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Only administrators can use this command.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📌 Mod Guide — Points Bot')
      .setColor(0x5865F2)
      .setDescription(
        'Aap log contributor program ke liye points manage karoge. Points sirf genuine contribution ke liye do — bekar mein dena allowed nahi hai.'
      )
      .addFields(
        {
          name: '⚙️ Commands',
          value:
            '`/addpt amount: users:` — users ko points do (multiple @mention ho sakte hain, equally milega)\n' +
            '`/rempt amount: users:` — points remove karo (floor 0 tak jayega)\n' +
            '`/leaderboard` — top 10 users ka points board\n' +
            '`/mod-stats` — kis mod ne kitna distribute/remove kiya',
        },
        {
          name: '🔄 Flow',
          value: 'Command run karo → reason type karo → review dekho → **Confirm** ya **Cancel**',
        },
        {
          name: '✅ Responsibilities',
          value:
            '• Reason hamesha clear aur specific likho\n' +
            '• Bina valid contribution ke points mat do\n' +
            '• Remove karte waqt bhi proper reason do\n' +
            '• Har action logged hai — sab track hota hai',
        },
        {
          name: '⚠️ Dhyan Rakho',
          value: 'Ek baar **Confirm** ho gaya toh undo nahi hota. Review carefully karo pehle.',
        },
      )
      .setFooter({ text: 'Points Bot • Contributor Program' })
      .setTimestamp();

    await interaction.reply({ flags: MessageFlags.Ephemeral, content: '✅ Guide posted!' });
    await interaction.channel.send({ embeds: [embed] });
  },
};
