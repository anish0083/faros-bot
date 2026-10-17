const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder,
} = require('discord.js');
const { getModStats, getModStatsCount, getAllModStats } = require('../utils/pointsDatabase');

const PAGE_SIZE = 10;
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

async function buildModStatsPage(guild, guildId, page) {
  const total = await getModStatsCount(guildId);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const rows = await getModStats(guildId, PAGE_SIZE, safePage * PAGE_SIZE);

  if (!rows.length) {
    return {
      embed: new EmbedBuilder()
        .setTitle('🛡️ Mod Activity Stats')
        .setDescription('No points have been distributed yet.')
        .setColor(0xFFA500),
      page: 0,
      totalPages: 1,
    };
  }

  const startRank = safePage * PAGE_SIZE;
  const lines = await Promise.all(rows.map(async (row, i) => {
    const rank = startRank + i;
    let name;
    try {
      const member = await guild.members.fetch(row.mod_discord_id);
      name = member.displayName;
    } catch {
      name = `Unknown (${row.mod_discord_id.slice(-4)})`;
    }
    const medal = RANK_MEDALS[rank] ?? `\`${String(rank + 1).padStart(2, ' ')}.\``;
    const distributed = Number(row.total_distributed);
    const removed = Number(row.total_removed);
    return `${medal} **${name}**\n┣ 📤 Distributed: **${distributed} pts**\n┗ 📥 Removed: **${removed} pts**`;
  }));

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Mod Activity Stats')
    .setDescription(lines.join('\n\n'))
    .setColor(0xFFA500)
    .setFooter({ text: `Page ${safePage + 1} of ${totalPages} • ${total} mods total` })
    .setTimestamp();

  return { embed, page: safePage, totalPages };
}

function buildButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ms_page:${page - 1}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`ms_page:${page + 1}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('ms_export')
      .setLabel('📥 Export CSV')
      .setStyle(ButtonStyle.Primary),
  );
}

module.exports = async function handleModStatsNav(interaction) {
  // CSV export
  if (interaction.customId === 'ms_export') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const all = await getAllModStats(interaction.guildId);
    if (!all.length) {
      await interaction.editReply({ content: 'No data to export.' });
      return;
    }

    const lines = ['Rank,Mod ID,Display Name,Distributed,Removed'];
    for (let i = 0; i < all.length; i++) {
      const row = all[i];
      let name;
      try {
        const member = await interaction.guild.members.fetch(row.mod_discord_id);
        name = member.displayName.replace(/,/g, ' ');
      } catch {
        name = 'Unknown';
      }
      lines.push(`${i + 1},${row.mod_discord_id},${name},${Number(row.total_distributed)},${Number(row.total_removed)}`);
    }

    const csv = lines.join('\n');
    const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: 'mod-stats.csv' });
    await interaction.editReply({ content: '📥 Here is the CSV export:', files: [attachment] });
    return;
  }

  // Pagination
  const page = parseInt(interaction.customId.replace('ms_page:', ''), 10);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { embed, page: safePage, totalPages } = await buildModStatsPage(interaction.guild, interaction.guildId, page);
  const row = buildButtons(safePage, totalPages);

  await interaction.editReply({ embeds: [embed], components: [row] });
};

module.exports.buildModStatsPage = buildModStatsPage;
module.exports.buildButtons = buildButtons;
