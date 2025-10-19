// В самом начале main.js добавьте:
const BOT_API_URL = 'https://salon-8lor.onrender.com'; // Ваш реальный URL

// Обновите функцию подтверждения записи:
confirmBtn.addEventListener('click', async () => {
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const date = dateInput.value;
  const time = document.querySelector('.time-slot.selected')?.textContent;
  const serviceOption = serviceSelect.options[serviceSelect.selectedIndex];
  const serviceName = serviceOption.text;
  const servicePrice = serviceOption.value;
  const serviceDuration = serviceOption.dataset.duration || '60 мин';
  
  if (!name || !phone || !date || !time || !servicePrice) {
    alert('Пожалуйста, заполните все поля формы и выберите время');
    return;
  }

  const booking = {
    id: Date.now().toString(), // Важно: строка!
    name: name,
    phone: phone,
    date: date,
    time: time,
    serviceName: serviceName,
    servicePrice: servicePrice,
    serviceDuration: serviceDuration
  };

  console.log('🔄 Отправляю запись:', booking);

  try {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Отправка...';

    const response = await fetch(`${BOT_API_URL}/api/book`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(booking)
    });

    const result = await response.json();
    console.log('📨 Ответ сервера:', result);
    
    if (result.success) {
      console.log('✅ Запись создана! ID:', result.bookingId);
      
      // Открываем бота
      const botUrl = `https://t.me/NadezhdaBeauty_Bot?start=${result.bookingId}`;
      window.open(botUrl, '_blank');
      
      alert(`✅ Запись отправлена!\n\nID: ${result.bookingId}\n\nОткрываю чат с ботом...`);
      
      // Сбрасываем форму
      document.getElementById('booking-form').reset();
      generateTimeSlots();
      
    } else {
      console.error('❌ Ошибка:', result.error);
      alert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('❌ Ошибка сети:', error);
    alert('Ошибка соединения. Попробуйте позже или позвоните нам.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Записаться';
  }
});
