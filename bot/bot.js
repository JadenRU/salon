const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const ADMIN_CHAT_ID = '828439309';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

app.post('/api/book', (req, res) => {
    const { name, phone, date, time, service } = req.body;
    if(!name || !phone || !date || !time || !service) return res.status(400).json({ message:'Неверные данные' });

    const message = `Новая запись:\nИмя: ${name}\nТелефон: ${phone}\nДата: ${date}\nВремя: ${time}\nУслуга: ${service}`;
    bot.sendMessage(ADMIN_CHAT_ID, message).catch(console.error);
    res.json({ message: 'Запись успешно отправлена' });
});

app.get('*', (req,res)=>{ res.sendFile(path.join(__dirname,'../public/index.html')) });
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));

bot.on('message', (msg)=>{ bot.sendMessage(msg.chat.id, "Привет! Бот готов принимать ваши записи."); });
