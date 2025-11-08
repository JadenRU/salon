// server.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");

const app = express();

// --- Env ---
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

// --- Middlewares ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Static ---
app.use(express.static(path.join(__dirname, "public")));

// --- Data storage ---
const BOOKINGS_FILE = path.join(__dirname, "bookings.json");

// Read bookings (return array)
function readBookings() {
  try {
    if (!fs.existsSync(BOOKINGS_FILE)) return [];
    const data = fs.readFileSync(BOOKINGS_FILE, "utf8");
    if (!data) return [];
    return JSON.parse(data);
  } catch (err) {
    console.error("readBookings error:", err);
    return [];
  }
}

// Write bookings atomically (write tmp -> rename)
function writeBookings(bookings) {
  try {
    const tmp = BOOKINGS_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(bookings, null, 2), "utf8");
    fs.renameSync(tmp, BOOKINGS_FILE);
  } catch (err) {
    console.error("writeBookings error:", err);
    throw err;
  }
}

// Normalize helpers
function normalizeDate(dateStr) {
  // Expect YYYY-MM-DD, minimal check
  return String(dateStr);
}
function normalizeTime(timeStr) {
  const parts = String(timeStr).split(":");
  const hh = String(parts[0] || "0").padStart(2, "0");
  const mm = String(parts[1] || "0").padStart(2, "0");
  return `${hh}:${mm}`;
}

// --- Telegram bot setup ---
let bot = null;
if (!BOT_TOKEN) {
  console.warn("BOT_TOKEN not defined in .env — Telegram disabled");
} else {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  // Handle /start [payload] — link chat to booking when payload present
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const payload = match && match[1] ? match[1].trim() : null;

    if (!payload) {
      // Normal start
      return bot.sendMessage(chatId, "Здравствуйте! Чтобы получать напоминания о записи, откройте бота из сайта после оформления брони (нажмите Start).");
    }

    const bookingId = payload;
    try {
      // Use fetch — Node 18+ has global fetch; try to use it, otherwise require node-fetch
      let fetchFn = global.fetch;
      if (!fetchFn) {
        fetchFn = (...args) => import('node-fetch').then(m => m.default(...args));
      }
      const resp = await fetchFn(`${SERVER_URL}/api/link-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, chatId })
      });
      const json = await resp.json().catch(()=>null);
      if (resp.ok && json && json.success) {
        await bot.sendMessage(chatId, `Ваша запись #${bookingId} успешно связана. Вы будете получать уведомления и напоминания.`);
        // Optionally notify admin
        if (ADMIN_CHAT_ID) {
          bot.sendMessage(ADMIN_CHAT_ID, `Пользователь связал бронь ${bookingId} с chat_id ${chatId}`);
        }
      } else {
        await bot.sendMessage(chatId, `Не удалось связать запись ${bookingId}. Проверьте правильность ID или попробуйте позже.`);
      }
    } catch (e) {
      console.error("bot /start error:", e);
      try { await bot.sendMessage(chatId, "Ошибка при связывании записи. Попробуйте ещё раз позже."); } catch {}
    }
  });

  // Simple /help handler
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, "Бот салона: откройте бота через сайт после записи (нажмите Start), чтобы получать напоминания.");
  });
}

// --- API: POST /api/book  (create booking) ---
// Checks conflict by date+time, returns botDeepLink if BOT_USERNAME present
app.post("/api/book", (req, res) => {
  try {
    const {
      name,
      phone,
      date: rawDate,
      time: rawTime,
      serviceName,
      servicePrice,
      serviceDuration,
    } = req.body;

    if (!name || !phone || !rawDate || !rawTime || !serviceName) {
      return res.status(400).json({ success: false, error: "missing_fields" });
    }

    const date = normalizeDate(rawDate);
    const time = normalizeTime(rawTime);

    const bookings = readBookings();

    // conflict if same date+time and not cancelled
    const conflict = bookings.find(b => b.date === date && b.time === time && b.status !== "cancelled");
    if (conflict) {
      return res.status(409).json({ success: false, error: "slot_occupied" });
    }

    const id = Date.now().toString();
    const booking = {
      id,
      name,
      phone,
      date,
      time,
      serviceName,
      servicePrice: servicePrice || null,
      serviceDuration: serviceDuration || null,
      createdAt: new Date().toISOString(),
      status: "new"
    };

    bookings.push(booking);
    writeBookings(bookings);

    // Notify admin
    const message =
      `📌 Новая запись\n` +
      `👤 Имя: ${name}\n` +
      `📞 Телефон: ${phone}\n` +
      `💆 Услуга: ${serviceName}\n` +
      `⏱ Длительность: ${serviceDuration || "-"} мин\n` +
      `💰 Цена: ${servicePrice || "-"} ₽\n` +
      `📅 Дата: ${date}\n` +
      `🕒 Время: ${time}\n` +
      `🆔 ID: ${id}`;

    if (ADMIN_CHAT_ID && bot) {
      bot.sendMessage(ADMIN_CHAT_ID, message).catch(e => console.error("notify admin error:", e));
    }

    const botDeepLink = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?start=${id}` : null;
    return res.json({ success: true, id, botDeepLink });
  } catch (err) {
    console.error("POST /api/book error:", err);
    return res.status(500).json({ success: false, error: "server_error" });
  }
});

// --- API: GET /api/bookings?date=YYYY-MM-DD  ---
app.get("/api/bookings", (req, res) => {
  try {
    const dateQuery = req.query.date;
    const bookings = readBookings();
    if (!dateQuery) {
      return res.json(bookings);
    }
    const date = normalizeDate(dateQuery);
    const filtered = bookings.filter(b => b.date === date);
    const result = filtered.map(b => ({ id: b.id, time: b.time, name: b.name, serviceName: b.serviceName, status: b.status || "new", chatId: b.chatId || null }));
    return res.json(result);
  } catch (err) {
    console.error("GET /api/bookings error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// --- API: POST /api/link-chat  { bookingId, chatId } ---
app.post("/api/link-chat", (req, res) => {
  try {
    const { bookingId, chatId } = req.body;
    if (!bookingId || !chatId) return res.status(400).json({ success: false, error: "missing_fields" });

    const bookings = readBookings();
    const b = bookings.find(x => String(x.id) === String(bookingId));
    if (!b) return res.status(404).json({ success: false, error: "not_found" });

    b.chatId = String(chatId);
    b.status = b.status || "new";
    writeBookings(bookings);

    // notify admin
    if (ADMIN_CHAT_ID && bot) {
      bot.sendMessage(ADMIN_CHAT_ID, `Пользователь связал бронь ${bookingId} с chat_id ${chatId}`).catch(()=>{});
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("POST /api/link-chat error:", err);
    return res.status(500).json({ success: false, error: "server_error" });
  }
});

// --- Helper: send reminder for booking ---
function sendReminderForBooking(booking) {
  if (!bot || !booking.chatId) return;
  try {
    const text = `Напоминание: ваша запись ${booking.date} в ${booking.time} — ${booking.serviceName}. Если нужно отменить или перенести, ответьте сюда.`;
    bot.sendMessage(booking.chatId, text).catch(e => console.error("sendReminder error:", e));
  } catch (e) {
    console.error("sendReminderForBooking error:", e);
  }
}

// --- Cron: daily admin reminder (same as before) ---
cron.schedule("0 9 * * *", () => {
  if (ADMIN_CHAT_ID && bot) {
    bot.sendMessage(ADMIN_CHAT_ID, "🔔 Ежедневное напоминание: проверьте записи на сегодня.").catch(()=>{});
  }
});

// --- Cron: reminders to clients a day before at 18:00 ---
cron.schedule("0 18 * * *", () => {
  try {
    const bookings = readBookings();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    const targetDate = `${yyyy}-${mm}-${dd}`;

    const toRemind = bookings.filter(b => b.date === targetDate && b.chatId);
    if (toRemind.length && ADMIN_CHAT_ID && bot) {
      bot.sendMessage(ADMIN_CHAT_ID, `📋 Записи на завтра (${targetDate}) с chat_id:\n` + toRemind.map(b => `— ${b.time} | ${b.name} | ${b.serviceName} | chat:${b.chatId}`).join("\n")).catch(()=>{});
    }
    // send to clients
    toRemind.forEach(b => sendReminderForBooking(b));
  } catch (e) {
    console.error("cron remind error:", e);
  }
});

// --- Fallback to index.html (SPA-like) ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Server running on ${SERVER_URL}`);
});
