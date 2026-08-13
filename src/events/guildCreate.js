const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { CHAIN, NFT, explorerAddressLink, chainFooter } = require('../config/chain');

module.exports = {
  name: 'guildCreate',
  once: false,

  async execute(guild) {
    try {
      const channel = await guild.channels.create({
        name: 'config-faros-bot',
        type: ChannelType.GuildText,
        topic: 'Faros Bot configuration — admin use only',
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setTitle('👋 Faros Bot — Server Setup')
        .setDescription(
          'Thanks for adding Faros NFT Bot!\n\n' +
          '**Setup — 2 steps:**\n' +
          '1. `/config role:@YourRole` — verified holders will receive this role\n' +
          '2. `/setupnft` — run it in the channel where you want the claim button\n\n' +
          '**What gets verified:**\n' +
          `• Chain: **${CHAIN.name}**\n` +
          `• Collection: **${NFT.name}**\n` +
          `• Contract: ${explorerAddressLink(NFT.address)}\n\n` +
          '**Required:** the bot needs the **Manage Roles** permission, and its role must sit ' +
          '**above** the target role in Server Settings → Roles.\n\n' +
          '*Only server administrators can see this channel.*'
        )
        .setColor(0xFF4500)
        .setFooter({ text: `Faros Bot • ${chainFooter()}` });

      await channel.send({ embeds: [embed] });
      console.log(`[GuildCreate] Created config channel in "${guild.name}" (${guild.id})`);
    } catch (error) {
      console.error(`[GuildCreate] Failed in "${guild.name}":`, error.message);
    }
  },
};
