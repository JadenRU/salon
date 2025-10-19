// === bot.js ===
// Telegram Bot + PostgreSQL + уведомление мастеру

const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

const TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const DATABASE_URL = 'postgresql://salon_bookings_user:lyJtYwUBxNBScuNTQvJDjRiNb9O7AhQz@dpg-d3qhsd63jp1c738krfd0-a/salon_bookings';
const MASTER_CHAT_ID = '828439309';
const WEB_APP_URL = 'https://salon-8lor.onrender.com';
const PORT = process.env.PORT || 10000;

const app = express();
app.use(bodyParser.json());

const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${WEB_APP_URL}/bot${TOKEN}`);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создание таблицы при старте
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

// POST /api/book
app.post('/api/book', async (req, res) => {
  const b = req.body;
  if (!b.id || !b.name || !b.phone || !b.date || !b.time) {
    return res.status(400).json({ success: false, error: 'Неверные данные' });
  }

  const client = await pool.connect();
  try {
    // Проверка занятости времени
    const check = await client.query(
      'SELECT id FROM bookings WHERE date=$1 AND time=$2 LIMIT 1',
      [b.date, b.time]
    );
    if (check.rows.length > 0) {
      return res.json({ success: false, error: 'Это время уже занято' });
    }

    await client.query(
      `INSERT INTO bookings (id,name,phone,date,time,service_name,service_price,service_duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [b.id, b.name, b.phone, b.date, b.time, b.serviceName, b.servicePrice, b.serviceDuration || '60']
    );

    // Уведомление мастеру
    const msg = `💌 Новая запись!\nИмя: ${b.name}\nТелефон: ${b.phone}\nДата: ${b.date}\nВремя: ${b.time}\nУслуга: ${b.serviceName}\nЦена: ${b.servicePrice} ₽`;
    bot.sendMessage(MASTER_CHAT_ID, msg);

    res.json({ success: true, bookingId: b.id });
    console.log('✅ Новая бронь сохранена:', b);
  } catch (err) {
    console.error('❌ Ошибка при бронировании:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Webhook Telegram
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// /start <id>
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const bookingId = match[1];
  if (!bookingId) return bot.sendMessage(chatId, '👋 Привет! Сделайте запись на сайте.');

  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
    if (rows.length === 0) return bot.sendMessage(chatId, '❌ Запись не найдена.');

    const b = rows[0];
    const text =
      `✅ *Ваша запись подтверждена!*\n\n` +
      `👩‍💼 *Имя:* ${b.name}\n` +
      `📞 *Телефон:* ${b.phone}\n` +
      `📅 *Дата:* ${b.date}\n` +
      `⏰ *Время:* ${b.time}\n` +
      `💆‍♀️ *Услуга:* ${b.service_name}\n` +
      `💰 *Цена:* ${b.service_price} ₽`;

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Ошибка при получении брони:', err);
    bot.sendMessage(chatId, '⚠️ Ошибка сервера, попробуйте позже.');
  } finally {
    client.release();
  }
});

app.get('/', (_, res) => res.send('✅ Telegram Bot с PostgreSQL и уведомлениями работает'));

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на ${PORT}`);
  console.log(`🌐 Webhook: ${WEB_APP_URL}/bot${TOKEN}`);
});
