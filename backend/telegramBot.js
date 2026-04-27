const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi! Bot ishga tushmadi.');
  return;
}

const bot = new Telegraf(token);

// Bot ma'lumotlarini olish (username va h.k.)
let botInfo = {};
bot.telegram.getMe().then(info => {
  botInfo = info;
  console.log(`🤖 Bot @${info.username} sifatida tayyor!`);
});

/**
 * Guruhdagi adminlarni tekshirish funksiyasi
 */
async function isAdmin(ctx) {
  try {
    // Shaxsiy yozishmalarda hammani admin deb hisoblaymiz
    if (ctx.chat.type === 'private') return true;

    const member = await ctx.getChatMember(ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (e) {
    console.error('Adminni tekshirishda xato:', e);
    return false;
  }
}

// Barcha xabarlarni kuzatish
bot.on('message', async (ctx) => {
  // Faqat guruh yoki superguruhlarda ishlaydi
  if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return;

  const userIsAdmin = await isAdmin(ctx);

  if (!userIsAdmin) {
    try {
      const appUrl = `https://t.me/yurtaxi_bot/app`;

      // Yo'lovchiga Mini Ilova linkini REPLY qilib yuborish
      await ctx.reply(
        `Hurmatli ${ctx.from.first_name || 'foydalanuvchi'}! 👋\n\nGuruhda yozish o'rniga, quyidagi tugmani bosing va o'z yo'nalishingiz bo'yicha tezroq taksi toping! 🚖`,
        {
          reply_to_message_id: ctx.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Mini Ilovani ochish', url: appUrl }],
              [{ text: '📲 Toʻgʻridan-toʻgʻri havola', url: appUrl }]
            ]
          }
        }
      );
    } catch (err) {
      console.error('Xabarni boshqarishda xatolik:', err.response?.description || err.message);
    }
  }
});

bot.launch().then(() => {
  console.log('🚀 Telegram Bot guruhlarda xizmat ko\'rsatishni boshladi!');
}).catch(err => {
  console.error('Bot launch error:', err);
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
