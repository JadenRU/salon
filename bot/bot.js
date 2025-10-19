const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Твой бот
const TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const ADMIN_ID = 828439309;

const app = express();
app.use(express.json());

// Разрешаем CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Создаем бота
const bot = new TelegramBot(TOKEN, { polling: true });

// Хранилище записей в памяти
let bookings = [];
let clients = {};

console.log('🤖 Бот инициализирован');

// API endpoint для приема записей с сайта
app.post('/api/book', (req, res) => {
  console.log('📨 Получен запрос на создание записи');
  
  try {
    const booking = req.body;
    
    console.log('Данные записи:', {
      id: booking.id,
      name: booking.name,
      phone: booking.phone,
      date: booking.date,
      time: booking.time,
      service: booking.serviceName,
      price: booking.servicePrice
    });

    // Проверяем обязательные поля
    if (!booking.id || !booking.name || !booking.phone || !booking.date || !booking.time || !booking.serviceName || !booking.servicePrice) {
      console.log('❌ Не все обязательные поля заполнены');
      return res.status(400).json({ 
        success: false,
        error: 'Не все обязательные поля заполнены',
        received: booking 
      });
    }
    
    // Создаем новую запись
    const newBooking = {
      id: booking.id.toString(), // Преобразуем в строку для надежности
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
    
    // Добавляем запись в массив
    bookings.push(newBooking);
    
    console.log('✅ Запись добавлена в память. Всего записей:', bookings.length);
    console.log('Все ID записей:', bookings.map(b => b.id));
    
    // Уведомление администратору
    bot.sendMessage(ADMIN_ID, 
      `📋 НОВАЯ ЗАПИСЬ С САЙТА!\n\n` +
      `👤 Имя: ${newBooking.name}\n` +
      `📞 Телефон: ${newBooking.phone}\n` +
      `📅 Услуга: ${newBooking.serviceName}\n` +
      `📆 Дата: ${newBooking.date}\n` +
      `⏰ Время: ${newBooking.time}\n` +
      `💳 Стоимость: ${newBooking.servicePrice} ₽\n\n` +
      `ID записи: ${newBooking.id}\n` +
      `Ссылка: https://t.me/NadezhdaBeauty_Bot?start=${newBooking.id}`
    ).then(() => {
      console.log('✅ Уведомление отправлено администратору');
    }).catch(error => {
      console.error('❌ Ошибка отправки уведомления:', error);
    });
    
    res.json({ 
      success: true, 
      message: 'Запись успешно создана', 
      bookingId: newBooking.id,
      botUrl: `https://t.me/NadezhdaBeauty_Bot?start=${newBooking.id}`,
      totalBookings: bookings.length
    });
    
  } catch (error) {
    console.error('❌ Ошибка при создании записи:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error.message 
    });
  }
});

// Команда /start
bot.onText(/\/start(?: (\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const bookingId = match[1];
  
  console.log(`🔔 /start от ${chatId}, ID записи: ${bookingId}`);
  console.log(`📊 Всего записей в памяти: ${bookings.length}`);
  console.log(`ID всех записей: ${bookings.map(b => b.id).join(', ')}`);
  
  if (bookingId) {
    // Ищем запись
    const booking = bookings.find(b => b.id === bookingId.toString());
    
    if (booking) {
      console.log('✅ Запись найдена:', booking);
      
      // Сохраняем chatId для напоминаний
      clients[booking.id] = chatId;
      booking.chatId = chatId;
      booking.status = 'confirmed';
      booking.confirmedAt = new Date().toISOString();
      
      bot.sendMessage(chatId, 
        `✅ ВАША ЗАПИСЬ ПОДТВЕРЖДЕНА!\n\n` +
        `📅 Услуга: ${booking.serviceName}\n` +
        `📆 Дата: ${booking.date}\n` +
        `⏰ Время: ${booking.time}\n` +
        `💳 Стоимость: ${booking.servicePrice} ₽\n\n` +
        `Мы отправим вам напоминание за день и за 2 часа до визита.`
      );
      
      // Уведомление администратору
      bot.sendMessage(ADMIN_ID,
        `✅ ЗАПИСЬ ПОДТВЕРЖДЕНА КЛИЕНТОМ!\n\n` +
        `👤 Имя: ${booking.name}\n` +
        `📞 Телефон: ${booking.phone}\n` +
        `📅 Услуга: ${booking.serviceName}\n` +
        `📆 Дата: ${booking.date}\n` +
        `⏰ Время: ${booking.time}\n` +
        `💳 Стоимость: ${booking.servicePrice} ₽`
      );
      
    } else {
      console.log('❌ Запись не найдена! Искомый ID:', bookingId);
      console.log('Доступные записи:', bookings);
      
      bot.sendMessage(chatId, 
        `❌ ЗАПИСЬ НЕ НАЙДЕНА!\n\n` +
        `ID: ${bookingId}\n\n` +
        `Пожалуйста, свяжитесь с администратором и сообщите этот ID.`
      );
      
      bot.sendMessage(ADMIN_ID,
        `❌ КЛИЕНТ НЕ СМОГ ПОДТВЕРДИТЬ ЗАПИСЬ!\n\n` +
        `ID: ${bookingId}\n` +
        `Chat ID: ${chatId}\n` +
        `Всего записей: ${bookings.length}\n` +
        `ID записей: ${bookings.map(b => b.id).join(', ') || 'нет записей'}`
      );
    }
  } else {
    bot.sendMessage(chatId, 
      '👋 Добро пожаловать!\n\n' +
      'Я бот-помощник косметолога Надежды Гнатюк.\n\n' +
      'Для подтверждения записи перейдите по ссылке с сайта.\n\n' +
      'Если возникли проблемы - свяжитесь с администратором.'
    );
  }
});

// Обработка обычных сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && msg.text.startsWith('/')) return;
  
  if (chatId !== ADMIN_ID) {
    const userName = msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : '');
    bot.sendMessage(ADMIN_ID, 
      `✉️ Сообщение от ${userName} (@${msg.from.username || 'нет username'}):\n\n${msg.text}`
    );
    bot.sendMessage(chatId, '✅ Ваше сообщение отправлено администратору!');
  }
});

// Напоминание за день
const cron = require('node-cron');
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

// Напоминание за 2 часа
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

// Маршруты для отладки
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ Bot is running', 
    bookingsCount: bookings.length,
    bookings: bookings.map(b => ({ 
      id: b.id, 
      name: b.name, 
      date: b.date, 
      time: b.time,
      status: b.status 
    }))
  });
});

app.get('/admin/bookings', (req, res) => {
  res.json({
    success: true,
    count: bookings.length,
    bookings: bookings
  });
});

// Очистка всех записей (для тестирования)
app.delete('/admin/bookings', (req, res) => {
  const count = bookings.length;
  bookings = [];
  res.json({ 
    success: true, 
    message: `Все записи (${count}) очищены` 
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📊 Начальное количество записей: ${bookings.length}`);
  console.log(`🌐 API: http://localhost:${PORT}/api/book`);
  console.log(`📋 Админка: http://localhost:${PORT}/admin/bookings`);
});

console.log('✅ Бот полностью запущен и готов к работе!');
