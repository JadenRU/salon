// === bot.js ===
// Полностью готовый сервер с Telegram Bot + API бронирования

const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

// ======================
// 🔧 Конфигурация
// ======================
const TOKEN = process.env.BOT_TOKEN; // Укажи в Render → Environment → BOT_TOKEN = 123456:ABC...
const WEB_APP_URL = 'https://salon-8lor.onrender.com'; // твой render-домен
const PORT = process.env.PORT || 3000;

// ======================
// 🚀 Инициализация
// ======================
const app = express();
app.use(bodyParser.json());

// Создаём бота без polling (используем webhook, так как Render не держит постоянное соединение)
const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${WEB_APP_URL}/bot${TOKEN}`);

// Временное хранилище броней (в RAM)
const bookings = {};

// ======================
// 📩 Маршрут для приема брони с сайта
// ======================
app.post('/api/book', async (req, res) => {
  try {
    const booking = req.body;

    // Проверяем наличие обязательных полей
    if (!booking || !booking.id || !booking.name || !booking.phone) {
      console.log('❌ Некорректные данные брони:', booking);
      return res.status(400).json({ success: false, error: 'Некорректные данные брони' });
    }

    // Сохраняем бронь в память
    bookings[booking.id] = booking;
    console.log('📅 Новая бронь получена:', booking);

    // Возвращаем ID клиенту
    res.json({ success: true, bookingId: booking.id });
  } catch (error) {
    console.error('❌ Ошибка обработки брони:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера при бронировании' });
  }
});

// ======================
// 🤖 Webhook для Telegram
// ======================
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ======================
// 💬 Обработка /start <bookingId>
// ======================
bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const bookingId = match[1];

  if (!bookingId) {
    bot.sendMessage(
      chatId,
      '👋 Добро пожаловать! Это бот косметолога Надежды.\n' +
      'Вы можете оформить запись через сайт и получить подтверждение здесь.'
    );
    return;
  }

  const booking = bookings[bookingId];
  if (!booking) {
    bot.sendMessage(
      chatId,
      '❌ Запись не найдена. Возможно, срок действия ссылки истёк или данные не дошли до сервера.'
    );
    return;
  }

  // Подтверждение клиенту
  const message =
    `✅ *Ваша запись подтверждена!*\n\n` +
    `👩‍💼 *Имя:* ${booking.name}\n` +
    `📞 *Телефон:* ${booking.phone}\n` +
    `📅 *Дата:* ${booking.date}\n` +
    `⏰ *Время:* ${booking.time}\n` +
    `💆‍♀️ *Услуга:* ${booking.serviceName}\n` +
    `💰 *Цена:* ${booking.servicePrice} ₽\n\n` +
    `Спасибо, что выбрали косметолога Надежду 🌸`;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  console.log(`📨 Подтверждение отправлено пользователю: ${booking.name}`);
});

// ======================
// 🕒 Тестовый маршрут
// ======================
app.get('/', (req, res) => {
  res.send('✅ Telegram Bot работает. API: /api/book');
});

// ======================
// 🚀 Запуск сервера
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Webhook установлен: ${WEB_APP_URL}/bot${TOKEN}`);
});
