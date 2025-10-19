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

// Разрешаем CORS для всех запросов
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

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
      console.log(`📂 Загружено ${bookings.length} записей:`, bookings.map(b => ({ id: b.id, name: b.name })));
    } else {
      console.log('📂 Файл записей не существует, создаем новый');
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки записей:', error);
  }
}

// Сохранение записей в файл
function saveBookings() {
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
    console.log(`💾 Сохранено ${bookings.length} записей`);
  } catch (error) {
    console.error('❌ Ошибка сохранения записей:', error);
  }
}

// Загружаем записи при старте
loadBookings();

// API endpoint для приема записей с сайта
app.post('/api/book', (req, res) => {
  try {
    const booking = req.body;
    
    console.log('📨 Получен запрос на создание записи:', {
      id: booking.id,
      name: booking.name,
      phone: booking.phone,
      date: booking.date,
      time: booking.time,
      service: booking.serviceName
    });

    // Проверяем обязательные поля
    if (!booking.id || !booking.name || !booking.phone || !booking.date || !booking.time || !booking.serviceName || !booking.servicePrice) {
      console.log('❌ Не все обязательные поля заполнены');
      return res.status(400).json({ 
        error: 'Не все обязательные поля заполнены',
        received: booking 
      });
    }
    
    // Проверяем, нет ли уже записи с таким ID
    const existingIndex = bookings.findIndex(b => b.id == booking.id);
    if (existingIndex !== -1) {
      console.log('⚠️ Запись с таким ID уже существует, обновляем:', booking.id);
      bookings[existingIndex] = {
        ...bookings[existingIndex],
        ...booking,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Добавляем новую запись
      const newBooking = {
        id: booking.id,
        name: booking.name,
        phone: booking.phone,
        date: booking.date,
        time: booking.time,
        serviceName: booking.serviceName,
        servicePrice: booking.servicePrice,
        serviceDuration: booking.serviceDuration || '60 мин',
        createdAt: new Date().toISOString(),
        status: 'pending'
      };
      
      bookings.push(newBooking);
      console.log('✅ Новая запись добавлена:', newBooking);
    }
    
    saveBookings();
    
    // Уведомление администратору
    bot.sendMessage(ADMIN_ID, 
      `📋 Новая запись с сайта!\n\n` +
      `👤 Имя: ${booking.name}\n` +
      `📞 Телефон: ${booking.phone}\n` +
      `📅 Услуга: ${booking.serviceName}\n` +
      `📆 Дата: ${booking.date}\n` +
      `⏰ Время: ${booking.time}\n` +
      `💳 Стоимость: ${booking.servicePrice} ₽\n\n` +
      `ID записи: ${booking.id}\n` +
      `Ссылка для подтверждения: https://t.me/NadezhdaBeauty_Bot?start=${booking.id}`
    ).catch(error => {
      console.error('❌ Ошибка отправки уведомления администратору:', error);
    });
    
    res.json({ 
      success: true, 
      message: 'Запись добавлена', 
      bookingId: booking.id,
      botUrl: `https://t.me/NadezhdaBeauty_Bot?start=${booking.id}`
    });
    
  } catch (error) {
    console.error('❌ Ошибка при добавлении записи:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Команда /start
bot.onText(/\/start(?: (\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const bookingId = match[1];
  
  console.log(`🔔 Получена команда /start от ${chatId}, bookingId: ${bookingId}`);
  console.log('📊 Все записи в системе:', bookings.map(b => b.id));
  
  if (bookingId) {
    // Перезагружаем записи на случай, если они обновились
    loadBookings();
    
    // Клиент перешел по ссылке с ID записи
    const booking = bookings.find(b => b.id == bookingId);
    console.log('🔍 Поиск записи:', { 
      искомыйID: bookingId, 
      найденнаяЗапись: booking 
    });
    
    if (booking) {
      // Сохраняем chatId клиента для напоминаний
      clients[booking.id] = chatId;
      booking.chatId = chatId;
      booking.status = 'confirmed';
      booking.confirmedAt = new Date().toISOString();
      saveBookings();
      
      await bot.sendMessage(chatId, 
        `✅ Ваша запись подтверждена!\n\n` +
        `📅 Услуга: ${booking.serviceName}\n` +
        `📆 Дата: ${booking.date}\n` +
        `⏰ Время: ${booking.time}\n` +
        `💳 Стоимость: ${booking.servicePrice} ₽\n\n` +
        `Мы отправим вам напоминание за день и за 2 часа до визита.`
      );
      
      // Уведомление администратору
      await bot.sendMessage(ADMIN_ID,
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
      console.log('❌ Запись не найдена для ID:', bookingId);
      console.log('Доступные записи:', bookings);
      
      await bot.sendMessage(chatId, 
        `❌ Запись не найдена!\n\n` +
        `ID записи: ${bookingId}\n\n` +
        `Возможные причины:\n` +
        `• Запись еще не обработана системой (подождите 1-2 минуты)\n` +
        `• Произошел сбой при создании записи\n` +
        `• ID записи указан неверно\n\n` +
        `Пожалуйста, свяжитесь с администратором и сообщите этот ID.`
      );
      
      // Сообщаем администратору о проблеме
      await bot.sendMessage(ADMIN_ID,
        `❌ Клиент не смог подтвердить запись!\n\n` +
        `ID запрошенной записи: ${bookingId}\n` +
        `Chat ID клиента: ${chatId}\n` +
        `Всего записей в системе: ${bookings.length}\n` +
        `ID всех записей: ${bookings.map(b => b.id).join(', ')}`
      );
    }
  } else {
    // Обычный старт бота
    await bot.sendMessage(chatId, 
      '👋 Добро пожаловать!\n\n' +
      'Я бот-помощник косметолога Надежды Гнатюк.\n\n' +
      'Для подтверждения записи перейдите по ссылке, которую вы получили после оформления заявки на сайте.\n\n' +
      'Если у вас возникли проблемы, свяжитесь с администратором.'
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
    ).then(() => {
      bot.sendMessage(chatId, '✅ Ваше сообщение отправлено администратору. Мы ответим вам в ближайшее время!');
    }).catch(error => {
      console.error('Ошибка при пересылке сообщения:', error);
    });
  }
});

// Напоминания (оставьте как есть)
cron.schedule('0 10 * * *', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  bookings.forEach(booking => {
    if (booking.date === tomorrowStr && booking.chatId) {
      bot.sendMessage(booking.chatId, 
        `🔔 Напоминание: завтра в ${booking.time} у вас запись на "${booking.serviceName}"`
      ).catch(error => console.error('Ошибка отправки напоминания:', error));
    }
  });
});

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
      ).catch(error => console.error('Ошибка отправки напоминания:', error));
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
    bookings: bookings.map(b => ({ id: b.id, name: b.name, date: b.date, time: b.time })),
    webhook: `https://${req.get('host')}/bot${TOKEN}`,
    api: `https://${req.get('host')}/api/book`
  });
});

// Маршрут для просмотра всех записей (для отладки)
app.get('/admin/bookings', (req, res) => {
  res.json({
    count: bookings.length,
    bookings: bookings
  });
});

// Маршрут для принудительного обновления записей
app.post('/admin/reload', (req, res) => {
  loadBookings();
  res.json({ 
    message: 'Записи перезагружены',
    count: bookings.length 
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📊 Загружено записей: ${bookings.length}`);
  console.log(`🌐 API доступно по: https://salon-8lor.onrender.com/api/book`);
  console.log(`🤖 Бот готов к работе!`);
});
