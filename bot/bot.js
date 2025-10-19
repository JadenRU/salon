const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

// Твой бот
const TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const ADMIN_ID = 828439309;

// Создаем бота с опциями для избежания конфликтов
const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    timeout: 10,
    autoStart: true
  }
});

// Хранилище записей
let bookings = [];
let clients = {};

// Обработчик ошибок polling
bot.on('polling_error', (error) => {
  console.log('Polling error:', error.code, error.message);
  
  // Если конфликт - ждем и перезапускаем
  if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
    console.log('Обнаружен конфликт. Перезапуск через 10 секунд...');
    setTimeout(() => {
      bot.stopPolling();
      setTimeout(() => {
        bot.startPolling();
        console.log('🔄 Бот перезапущен после конфликта');
      }, 2000);
    }, 10000);
  }
});

// Команда /start
bot.onText(/\/start(?: (\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const bookingId = match[1];
  
  if (bookingId) {
    // Клиент перешел по ссылке с ID записи
    const booking = bookings.find(b => b.id == bookingId);
    if (booking) {
      // Сохраняем chatId клиента для напоминаний
      clients[booking.id] = chatId;
      booking.chatId = chatId;
      
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
        `✅ Новая запись подтверждена!\n\n` +
        `👤 Имя: ${booking.name}\n` +
        `📞 Телефон: ${booking.phone}\n` +
        `📅 Услуга: ${booking.serviceName}\n` +
        `📆 Дата: ${booking.date}\n` +
        `⏰ Время: ${booking.time}\n` +
        `💳 Стоимость: ${booking.servicePrice} ₽`
      );
    } else {
      bot.sendMessage(chatId, 'Запись не найдена. Пожалуйста, свяжитесь с администратором.');
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

// Функция добавления записи (для фронтенда)
function addBooking(booking) {
  bookings.push(booking);
  
  // Уведомление администратору о новой записи
  bot.sendMessage(ADMIN_ID, 
    `📋 Новая запись!\n\n` +
    `👤 Имя: ${booking.name}\n` +
    `📞 Телефон: ${booking.phone}\n` +
    `📅 Услуга: ${booking.serviceName}\n` +
    `📆 Дата: ${booking.date}\n` +
    `⏰ Время: ${booking.time}\n` +
    `💳 Стоимость: ${booking.servicePrice} ₽\n\n` +
    `ID записи: ${booking.id}`
  );
}

// Экспортируем для фронтенда
module.exports = { addBooking, bookings };

console.log('🤖 Бот запущен и работает! Ожидаем сообщения...');
