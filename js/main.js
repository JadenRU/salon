// В начале файла добавьте константу с URL вашего бота на Render
const BOT_API_URL = 'https://salon-8lor.onrender.com'; // ЗАМЕНИТЕ на реальный URL

// Обновите функцию подтверждения записи
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
    id: Date.now().toString(), // Преобразуем в строку для надежности
    name: name,
    phone: phone,
    date: date,
    time: time,
    serviceName: serviceName,
    servicePrice: servicePrice,
    serviceDuration: serviceDuration
  };

  console.log('Отправляю запись на сервер:', booking);

  try {
    // Показываем индикатор загрузки
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Отправка...';

    // Отправляем запись на сервер бота
    const response = await fetch(`${BOT_API_URL}/api/book`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(booking)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Запись успешно создана:', result);
      
      // Открываем бота с ID записи
      const botUrl = `https://t.me/NadezhdaBeauty_Bot?start=${booking.id}`;
      window.open(botUrl, '_blank');
      
      // Показываем сообщение об успехе
      alert(`✅ Запись отправлена!\n\nID вашей записи: ${booking.id}\n\nОткрыт чат с ботом для подтверждения.`);
      
      // Сбрасываем форму
      document.getElementById('booking-form').reset();
      generateTimeSlots();
      
    } else {
      console.error('❌ Ошибка при создании записи:', result);
      alert('Ошибка при отправке записи: ' + (result.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('❌ Ошибка сети:', error);
    alert('Ошибка соединения с сервером. Пожалуйста, попробуйте позже или свяжитесь с нами по телефону.');
  } finally {
    // Восстанавливаем кнопку
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Записаться';
  }
});
