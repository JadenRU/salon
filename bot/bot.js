// === bot.js ===
// Telegram Bot + API бронирования с сохранением данных в файл

const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// ======================
// 🔧 Конфигурация
// ======================
const TOKEN = process.env.BOT_TOKEN; // Render Environment → BOT_TOKEN = 123456:ABC...
const WEB_APP_URL = 'https://salon-8lor.onrender.com'; // твой render-домен
const PORT = process.env.PORT || 3000;
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');

// ======================
// 🚀 Инициализация
// ======================
const app = express();
app.use(bodyParser.json());

// Создаём бота (без polling)
const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${WEB_APP_URL}/bot${TOKEN}`);

// ======================
// 📂 Вспомогательные функции
// ======================
function loadBookings() {
  try {
    if (!fs.existsSync(BOOKINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
  } catch (err) {
    console.error('Ошибка загрузки файла брони:', err);
    return {};
  }
}

function saveBookings(data) {
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Ошибка сохранения файла брони:', err);
  }
}

// ======================
// 📩 Маршрут для приёма брони с сайта
// ======================
app.post('/api/book', async (req, res) => {
  try {
    const booking = req.body;

    if (!booking || !booking.id || !booking.name || !booking.phone) {
      console.log('❌ Некорректные данные брони:', booking);
      return res.status(400).json({ success: false, error: 'Некорректные данные брони' });
    }

    const bookings = loadBookings();
    bookings[booking.id] = booking;
    saveBookings(bookings);

    console.log('📅 Новая бронь сохранена:', booking);

    res.json({ success: true, bookingId: booking.id });
  } catch (error) {
    console.error('❌ Ошибка при сохранении брони:', error);
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

  const bookings = loadBookings();
  const booking = bookings[bookingId];

  if (!booking) {
    bot.sendMessage(
      chatId,
      '❌ Запись не найдена. Возможно, срок действия ссылки истёк или данные не дошли до сервера.'
    );
    console.log('⚠️ Не найдена бронь с ID:', bookingId);
    return;
  }

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
  console.log(`📨 Отправлено подтверждение для ${booking.name}`);
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
  console.log(`🌐 Webhook: ${WEB_APP_URL}/bot${TOKEN}`);
});
