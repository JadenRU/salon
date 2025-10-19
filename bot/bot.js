const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Твой бот
const TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const ADMIN_ID = 828439309;

const app = express();
app.use(express.json());

// Создаем бота
const bot = new TelegramBot(TOKEN);

// Файл для хранения записей
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');

// Загрузка записей из файла
let bookings = [];
let clients = {};

function loadBookings() {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
      bookings = JSON.parse(data);
      console.log(`📂 Загружено ${bookings.length} записей`);
    }
  } catch (error) {
    console.error('Ошибка загрузки записей:', error);
  }
}

// Сохранение записей в файл
function saveBookings() {
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
    console.log(`💾 Сохранено ${bookings.length} записей`);
  } catch (error) {
    console.error('Ошибка сохранения записей:', error);
  }
}

// Загружаем записи при старте
loadBookings();

// Настройка webhook
const setupWebhook = async () => {
  try {
    const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || 'https://your-app-name.onrender.com';
    await bot.setWebHook(`${WEBHOOK_URL}/bot${TOKEN}`);
    console.log(`🌐 Webhook установлен: ${WEBHOOK_URL}/bot${TOKEN}`);
  } catch (error) {
    console.error('❌ Ошибка настройки webhook:', error.message);
  }
};

// API endpoint для приема записей с сайта
app.post('/api/book', (req, res) => {
  try {
    const booking = req.body;
    
    // Проверяем обязательные поля
    if (!booking.id || !booking.name || !booking.phone || !booking.date || !booking.time || !booking.serviceName || !booking.servicePrice) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
    }
    
    // Добавляем запись
    const newBooking = {
      id: booking.id,
      name: booking.name,
      phone: booking.phone,
      date: booking.date,
      time: booking.time,
      serviceName: booking.serviceName,
      servicePrice: booking.servicePrice,
      serviceDuration: booking.serviceDuration || '60 мин',
      createdAt: new Date().toISOString()
    };
    
    bookings.push(newBooking);
    saveBookings();
    
    // Уведомление администратору
    bot.sendMessage(ADMIN_ID, 
      `📋 Новая запись с сайта!\n\n` +
      `👤 Имя: ${newBooking.name}\n` +
      `📞 Телефон: ${newBooking.phone}\n` +
      `📅 Услуга: ${newBooking.serviceName}\n` +
      `📆 Дата: ${newBooking.date}\n` +
      `⏰ Время: ${newBooking.time}\n` +
      `💳 Стоимость: ${newBooking.servicePrice} ₽\n\n` +
      `ID записи: ${newBooking.id}`
    ).catch(error => {
      console.error('Ошибка отправки уведомления:', error);
    });
    
    console.log('✅ Новая запись добавлена:', newBooking);
    res.json({ success: true, message: 'Запись добавлена', bookingId: newBooking.id });
  } catch (error) {
    console.error('Ошибка при добавлении записи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Команда /start
bot.onText(/\/start(?: (\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const bookingId = match[1];
  
  console.log(`Получена команда /start от ${chatId}, bookingId: ${bookingId}`);
  console.log('Доступные записи:', bookings.map(b => b.id));
  
  if (bookingId) {
    // Клиент перешел по ссылке с ID записи
    const booking = bookings.find(b => b.id == bookingId);
    if (booking) {
      // Сохраняем chatId клиента для напоминаний
      clients[booking.id] = chatId;
      booking.chatId = chatId;
      saveBookings();
      
      bot.sendMessage(chatId, 
        `✅ Ваша запись подтверждена!\n\n` +
        `📅 ${booking.serviceName}\n` +
        `📆 Дата: ${booking.date}\n` +
        `⏰ Время: ${booking.time}\n` +
        `💳 Стоимость: ${booking.servicePrice} ₽\n\n` +
        `Мы отправим вам напоминание за день и за 2 часа до визита.`
      );
      
      // Уведомление администратору
      bot.sendMessage(ADMIN_ID,
        `✅ Запись подтверждена клиентом!\n\n` +
        `👤 Имя: ${booking.name}\n` +
        `📞 Телефон: ${booking.phone}\n` +
        `📅 Услуга: ${booking.serviceName}\n` +
        `📆 Дата: ${booking.date}\n` +
        `⏰ Время: ${booking.time}\n` +
        `💳 Стоимость: ${booking.servicePrice} ₽\n\n` +
        `Chat ID клиента: ${chatId}`
      );
    } else {
      console.log('Запись не найдена для ID:', bookingId);
      bot.sendMessage(chatId, 
        'Запись не найдена. Это может произойти если:\n' +
        '• Запись была сделана более 24 часов назад\n' +
        '• Произошел сбой системы\n\n' +
        'Пожалуйста, свяжитесь с администратором для уточнения записи.'
      );
    }
  } else {
    // Обычный старт бота
    bot.sendMessage(chatId, 
      '👋 Добро пожаловать!\n\n' +
      'Я бот-помощник косметолога Надежды Гнатюк.\n\n' +
      'Если у вас есть вопросы или вы хотите записаться на процедуру, ' +
      'посетите наш сайт или свяжитесь напрямую с администратором.'
    );
  }
});

// Обработка обычных сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  // Игнорируем команды
  if (msg.text && msg.text.startsWith('/')) return;
  
  // Пересылаем сообщение администратору
  if (chatId !== ADMIN_ID) {
    const userName = msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : '');
    bot.sendMessage(ADMIN_ID, 
      `✉️ Сообщение от ${userName} (@${msg.from.username || 'нет username'}):\n\n${msg.text}`
    );
    bot.sendMessage(chatId, 'Ваше сообщение отправлено администратору. Мы ответим вам в ближайшее время!');
  }
});

// Напоминание за день до записи
cron.schedule('0 10 * * *', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  bookings.forEach(booking => {
    if (booking.date === tomorrowStr && booking.chatId) {
      bot.sendMessage(booking.chatId, 
        `🔔 Напоминание: завтра в ${booking.time} у вас запись на "${booking.serviceName}"`
      );
    }
  });
});

// Напоминание за 2 часа до записи
cron.schedule('0 * * * *', () => {
  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  bookings.forEach(booking => {
    if (!booking.chatId) return;
    
    const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
    if (bookingDateTime.getTime() <= inTwoHours.getTime() && 
        bookingDateTime.getTime() > now.getTime()) {
      bot.sendMessage(booking.chatId, 
        `⏰ Напоминание: через 2 часа у вас запись на "${booking.serviceName}"`
      );
    }
  });
});

// Обработка webhook запросов от Telegram
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Корневой маршрут для проверки работы
app.get('/', (req, res) => {
  res.json({ 
    status: 'Bot is running', 
    bookingsCount: bookings.length,
    webhook: `https://${req.get('host')}/bot${TOKEN}`,
    api: `https://${req.get('host')}/api/book`
  });
});

// Маршрут для просмотра всех записей (только для админа)
app.get('/admin/bookings', (req, res) => {
  res.json(bookings);
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📊 Загружено записей: ${bookings.length}`);
  
  // Настраиваем webhook после запуска сервера
  await setupWebhook();
});

console.log('🤖 Бот запущен!');
