const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildCreate',
  once: false,

  async execute(guild) {
    try {
      const channel = await guild.channels.create({
        name: 'config-Faros-bot',
        type: ChannelType.GuildText,
        topic: 'Pharos Bot configuration — admin use only',
        permissionOverwrites: [
          {
            id: guild.id, // @everyone denied — admins bypass this automatically
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setTitle('👋 Faros Bot — Server Setup')
        .setDescription(
          'Thanks for adding Faros NFT Bot!\n\n' +
          'Run `/config` in this channel to set up the bot for this server.\n\n' +
          '**You will need:**\n' +
          '• NFT Contract Address (on LitVM LiteForge testnet)\n' +
          '• RPC URL (LitVM default is pre-filled)\n' +
          '• Role ID to grant to NFT holders\n\n' +
          '**How to get Role ID:**\n' +
          'Discord Settings → Advanced → Enable Developer Mode\n' +
          'Then right-click the role → Copy Role ID\n\n' +
          '*Only server administrators can see this channel.*'
        )
        .setColor(0xFF4500)
        .setFooter({ text: 'Faros Bot • LitVM LiteForge Testnet' });

      await channel.send({ embeds: [embed] });
      console.log(`[GuildCreate] Created config channel in "${guild.name}" (${guild.id})`);
    } catch (error) {
      console.error(`[GuildCreate] Failed in "${guild.name}":`, error.message);
    }
  },
};
