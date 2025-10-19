const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

const TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const MASTER_CHAT_ID = '828439309';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.use(bodyParser.json());

let bookings = [];

// Получение новой записи с сайта
app.post('/new-booking', (req, res) => {
    const booking = req.body;
    bookings.push(booking);

    const msg = `🧴 Новая запись!\n\nИмя: ${booking.name}\nТелефон: ${booking.phone}\nУслуга: ${booking.serviceName}\nДата: ${booking.date} ${booking.time}\nЦена: ${booking.price} ₽`;
    
    bot.sendMessage(MASTER_CHAT_ID, msg)
        .then(() => console.log('Уведомление отправлено мастеру'))
        .catch(err => console.error('Ошибка отправки мастеру:', err));

    res.status(200).send('OK');
});

// Подтверждение записи клиентом через Telegram
bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const params = match[1].split('_');

    if (params[0] === 'confirm') {
        const name = decodeURIComponent(params[1]);
        const service = decodeURIComponent(params[2]);
        const date = params[3];
        const time = params[4];

        bot.sendMessage(chatId, `💖 Спасибо за подтверждение, ${name}!\nВаша процедура: ${service}\nДата: ${date} ${time}\nМы напомним вам за день и за 2 часа до визита 🌸`);

        // Сохраняем chatId клиента для напоминаний
        bookings = bookings.map(b => b.name === name ? { ...b, clientChatId: chatId } : b);
    }
});

// Функция напоминаний за 1 день и за 2 часа
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

// Проверка напоминаний каждый час
setInterval(sendReminders, 60 * 60 * 1000);

// Запуск сервера на Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot server running on port ${PORT}`));
