const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { setPtConfig } = require('../utils/pointsDatabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pt-config')
    .setDescription('Set which role can grant/remove points.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(opt =>
      opt.setName('mod_role')
        .setDescription('Role that can use /addPT and /remPT.')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Only administrators can run this command.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole('mod_role');
    await setPtConfig(interaction.guildId, role.id);

    await interaction.editReply({
      content: `✅ Points system configured!\n**Mod role:** <@&${role.id}>\nMembers with this role can now use \`/addPT\` and \`/remPT\`.`,
    });
  },
};
