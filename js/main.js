confirmBtn.addEventListener('click', async () => {
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const date = dateInput.value;
  const time = document.querySelector('.time-slot.selected')?.textContent;
  const serviceOption = serviceSelect.options[serviceSelect.selectedIndex];
  const serviceName = serviceOption.text;
  const servicePrice = serviceOption.value;
  const serviceDuration = serviceOption.dataset.duration;
  
  if (!name || !phone || !date || !time || !servicePrice) {
    alert('Пожалуйста, заполните все поля формы и выберите время');
    return;
  }

  const booking = {
    id: Date.now(),
    name,
    phone,
    date,
    time,
    serviceName,
    servicePrice,
    serviceDuration
  };

  try {
    // Отправляем запись на сервер бота
    const API_URL = 'https://your-app-name.onrender.com'; // Замените на ваш URL Render
    
    const response = await fetch(`${API_URL}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking)
    });

    const result = await response.json();
    
    if (result.success) {
      // Открываем бота с ID записи
      const botUrl = `https://t.me/NadezhdaBeauty_Bot?start=${booking.id}`;
      window.open(botUrl, '_blank');
      
      // Показываем сообщение об успехе
      alert('Запись отправлена! Открыт чат с ботом для подтверждения.');
      
      // Сбрасываем форму
      document.getElementById('booking-form').reset();
      generateTimeSlots();
    } else {
      alert('Ошибка при отправке записи: ' + result.error);
    }
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Ошибка соединения с сервером. Пожалуйста, попробуйте позже.');
  }
});
