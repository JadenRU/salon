import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Telegram bot info
const BOT_TOKEN = '8291779359:AAFMrCuA6GNyiHSsudpKhI7IdHEmOn8ulaI';
const USER_ID = '828439309';

app.post('/new-booking', async (req, res) => {
  const { name, phone, date, time, serviceName, price } = req.body;

  if (!name || !phone || !date || !time || !serviceName) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const message = `📌 Новая запись\nИмя: ${name}\nТелефон: ${phone}\nУслуга: ${serviceName}\nДата: ${date}\nВремя: ${time}\nСтоимость: ${price} ₽`;

  try {
    // Используем встроенный fetch в Node 18+
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: USER_ID,
        text: message
      })
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отправки в Telegram' });
  }
});

app.get('/', (req, res) => {
  res.send('Salon Booking Server is running.');
});

app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});
