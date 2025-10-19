const TelegramBot = require('node-telegram-bot-api');

// Твой бот
const TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const ADMIN_ID = 828439309;

const bot = new TelegramBot(TOKEN, { polling: true });

// Слоты и записи в памяти (можно подключить DB)
let bookings = [];

bot.onText(/\/start (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const bookingId = Number(match[1]);
  const booking = bookings.find(b => b.id === bookingId);
  if(booking){
    bot.sendMessage(chatId, `Привет, ${booking.name}! Ваша запись подтверждена:\n`+
      `${booking.serviceName}\nДата: ${booking.date} ${booking.time}\nСтоимость: ${booking.price} ₽`);
  } else {
    bot.sendMessage(chatId, 'Привет! У нас нет такой записи.');
  }
});

bot.on('message', msg => {
  // можно добавить обработку сообщений от клиентов
});

// Функция добавления записи
function addBooking(booking){
  bookings.push(booking);

  // Уведомление администратору
  bot.sendMessage(ADMIN_ID, `Новая запись!\n${booking.name}\n${booking.phone}\n${booking.serviceName}\n${booking.date} ${booking.time}`);

  // Уведомление клиенту через бот (если у него уже есть chatId)
  // в реальном кейсе нужно хранить chatId после первого запуска бота
  // demo: отправляем ссылку на /start
}

// Экспортируем для фронтенда через fetch
module.exports = { addBooking };
