const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder,
} = require('discord.js');
const { getLeaderboard, getLeaderboardCount, getAllLeaderboard } = require('../utils/pointsDatabase');

const PAGE_SIZE = 10;
const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = [0xFFD700, 0xC0C0C0, 0xCD7F32];

async function buildLeaderboardPage(guild, guildId, page) {
  const total = await getLeaderboardCount(guildId);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const rows = await getLeaderboard(guildId, PAGE_SIZE, safePage * PAGE_SIZE);

  if (!rows.length) {
    return {
      embed: new EmbedBuilder()
        .setTitle('🏆 Points Leaderboard')
        .setDescription('> No points awarded yet.\n> Use `/addpt` to get started!')
        .setColor(0x5865F2),
      page: 0,
      totalPages: 1,
    };
  }

  const startRank = safePage * PAGE_SIZE;
  const lines = await Promise.all(rows.map(async (row, i) => {
    const rank = startRank + i;
    let name;
    try {
      const member = await guild.members.fetch(row.discord_user_id);
      name = member.displayName;
    } catch {
      name = `Unknown (${row.discord_user_id.slice(-4)})`;
    }
    const medal = RANK_MEDALS[rank] ?? `\`${String(rank + 1).padStart(2, ' ')}.\``;
    const bar = '█'.repeat(Math.min(10, Math.ceil(row.points / 10))) || '░';
    return `${medal} **${name}**\n┗ ${bar} **${row.points} pts**`;
  }));

  const color = safePage === 0 ? (RANK_COLORS[0] ?? 0x5865F2) : 0x5865F2;

  const embed = new EmbedBuilder()
    .setTitle('🏆 Points Leaderboard')
    .setDescription(lines.join('\n\n'))
    .setColor(color)
    .setFooter({ text: `Page ${safePage + 1} of ${totalPages} • ${total} contributors` })
    .setTimestamp();

  return { embed, page: safePage, totalPages };
}

function buildButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb_page:${page - 1}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`lb_page:${page + 1}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('lb_export')
      .setLabel('📥 Export CSV')
      .setStyle(ButtonStyle.Primary),
  );
}

module.exports = async function handleLeaderboardNav(interaction) {
  // CSV export
  if (interaction.customId === 'lb_export') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const all = await getAllLeaderboard(interaction.guildId);
    if (!all.length) {
      await interaction.editReply({ content: 'No data to export.' });
      return;
    }

    const lines = ['Rank,User ID,Display Name,Points'];
    for (let i = 0; i < all.length; i++) {
      const row = all[i];
      let name;
      try {
        const member = await interaction.guild.members.fetch(row.discord_user_id);
        name = member.displayName.replace(/,/g, ' ');
      } catch {
        name = 'Unknown';
      }
      lines.push(`${i + 1},${row.discord_user_id},${name},${row.points}`);
    }

    const csv = lines.join('\n');
    const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: 'leaderboard.csv' });
    await interaction.editReply({ content: '📥 Here is the leaderboard CSV:', files: [attachment] });
    return;
  }

  // Pagination
  const page = parseInt(interaction.customId.replace('lb_page:', ''), 10);
  await interaction.deferUpdate();

  const { embed, page: safePage, totalPages } = await buildLeaderboardPage(interaction.guild, interaction.guildId, page);
  const row = buildButtons(safePage, totalPages);

  await interaction.editReply({ embeds: [embed], components: [row] });
};

module.exports.buildLeaderboardPage = buildLeaderboardPage;
module.exports.buildButtons = buildButtons;
