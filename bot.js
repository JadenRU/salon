const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

const TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

app.use(bodyParser.json());

let bookings = [];

app.post('/new-booking', (req, res) => {
  const booking = req.body;
  bookings.push(booking);
  const masterChatId = '828439309';
  const msg = `🧴 Новая запись!\n\nИмя: ${booking.name}\nТелефон: ${booking.phone}\nУслуга: ${booking.serviceName}\nДата: ${booking.date} ${booking.time}\nЦена: ${booking.price} ₽`;
  bot.sendMessage(masterChatId, msg);
  res.status(200).send('OK');
});

bot.onText(/\/start (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const params = match[1].split('_');
  if (params[0] === 'confirm') {
    const name = decodeURIComponent(params[1]);
    const service = decodeURIComponent(params[2]);
    const date = params[3];
    const time = params[4];

    bot.sendMessage(chatId, `💖 Спасибо за подтверждение, ${name}!\nВаша процедура: ${service}\nДата: ${date} ${time}\nМы напомним вам за день и за 2 часа до визита 🌸`);

    bookings = bookings.map(b => b.name === name ? { ...b, clientChatId: chatId } : b);
  }
});

function sendReminders() {
  const now = new Date();
  bookings.forEach(b => {
    if (!b.clientChatId) return;
    const visitDate = new Date(`${b.date}T${b.time}`);
    const diffHours = (visitDate - now) / (1000*60*60);
    if (Math.floor(diffHours) === 24 || Math.floor(diffHours) === 2) {
      bot.sendMessage(b.clientChatId, `💅 Напоминание: через ${Math.floor(diffHours)} часа(ов) у вас ${b.serviceName} в ${b.time}. До встречи!`);
    }
  });
}
setInterval(sendReminders, 60 * 60 * 1000);

app.listen(3000, () => console.log('Bot server running on port 3000'));
