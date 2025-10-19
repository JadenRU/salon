// === bot.js ===
// Telegram Bot + PostgreSQL хранение броней (Render-ready)

const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

// ======================
// 🔧 Конфигурация
// ======================
const TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const WEB_APP_URL = 'https://salon-8lor.onrender.com';
const PORT = process.env.PORT || 10000;

// ======================
// 🚀 Инициализация
// ======================
const app = express();
app.use(bodyParser.json());

// Telegram Bot (через Webhook)
const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${WEB_APP_URL}/bot${TOKEN}`);

// PostgreSQL подключение
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ======================
// 🗄️ Создание таблицы при старте
// ======================
(async () => {
  const client = await pool.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_price TEXT NOT NULL,
      service_duration TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  client.release();
  console.log('📦 Таблица bookings готова');
})();

// ======================
// 📩 API: создать бронь
// ======================
app.post('/api/book', async (req, res) => {
  try {
    const b = req.body;

    if (!b.id || !b.name || !b.phone || !b.date || !b.time) {
      return res.status(400).json({ success: false, error: 'Неверные данные' });
    }

    const client = await pool.connect();

    // Проверяем занятость времени
    const check = await client.query(
      'SELECT id FROM bookings WHERE date = $1 AND time = $2 LIMIT 1',
      [b.date, b.time]
    );
    if (check.rows.length > 0) {
      client.release();
      return res.json({ success: false, error: 'Это время уже занято' });
    }

    // Добавляем бронь
    await client.query(
      `INSERT INTO bookings (id, name, phone, date, time, service_name, service_price, service_duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        b.id,
        b.name,
        b.phone,
        b.date,
        b.time,
        b.serviceName,
        b.servicePrice,
        b.serviceDuration || '60'
      ]
    );

    client.release();
    console.log('✅ Сохранена новая бронь:', b);

    res.json({ success: true, bookingId: b.id });
  } catch (err) {
    console.error('❌ Ошибка при бронировании:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
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
// 💬 /start <bookingId>
// ======================
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const bookingId = match[1];

  if (!bookingId) {
    return bot.sendMessage(
      chatId,
      '👋 Привет! Это бот косметолога Надежды.\nОформите запись на сайте, чтобы получить подтверждение здесь.'
    );
  }

  try {
    const client = await pool.connect();
    const { rows } = await client.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    client.release();

    if (rows.length === 0) {
      return bot.sendMessage(chatId, '❌ Запись не найдена.');
    }

    const b = rows[0];
    const msgText =
      `✅ *Ваша запись подтверждена!*\n\n` +
      `👩‍💼 *Имя:* ${b.name}\n` +
      `📞 *Телефон:* ${b.phone}\n` +
      `📅 *Дата:* ${b.date}\n` +
      `⏰ *Время:* ${b.time}\n` +
      `💆‍♀️ *Услуга:* ${b.service_name}\n` +
      `💰 *Цена:* ${b.service_price} ₽`;

    bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Ошибка при загрузке брони:', err);
    bot.sendMessage(chatId, '⚠️ Ошибка при получении данных. Попробуйте позже.');
  }
});

// ======================
// 🧠 Тестовый маршрут
// ======================
app.get('/', (_, res) => res.send('✅ Telegram Bot с PostgreSQL работает'));

// ======================
// 🚀 Запуск сервера
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Webhook: ${WEB_APP_URL}/bot${TOKEN}`);
});
