// public/main.js

// --- Service data (синхронизировано с аккордеоном) ---
const serviceData = [
  { category: "Массажи", items: [
    { name: "Массаж лица", price: 2000, duration: 30 },
    { name: "Массаж спины", price: 3000, duration: 45 },
    { name: "Массаж всего тела", price: 5000, duration: 90 },
    { name: "Массаж головы", price: 1500, duration: 30 },
    { name: "Альгинатная маска", price: 600, duration: 30 }
  ]},
  { category: "Комплексные программы", items: [
    { name: "Комплекс спина + лицо", price: 5000, duration: 75 },
    { name: "Комплекс всего тела + лицо", price: 7000, duration: 120 },
    { name: "Массаж общий всего тела + лицо", price: 3500, duration: 90 }
  ]},
  { category: "Аппаратная косметология", items: [
    { name: "RF-лифтинг лица", price: 1000, duration: 30 },
    { name: "RF-лифтинг лица + шеи + декольте", price: 2000, duration: 60 },
    { name: "Микротоки лица", price: 1000, duration: 30 },
    { name: "Прессотерапия всего тела", price: 1100, duration: 45 },
    { name: "Вакуум (зона)", price: 900, duration: 30 }
  ]},
  { category: "Пилинги", items: [
    { name: "PRX-T33 (Италия)", price: 6625, duration: 60 },
    { name: "BioRePeelCl3 (Италия)", price: 8750, duration: 60 },
    { name: "Пилинг Молочный / Tropic / Миндаль", price: 1500, duration: 60 }
  ]},
  { category: "Уходовые процедуры", items: [
    { name: "Чистка лица комбинированная", price: 2000, duration: 60 }
  ]}
];

// --- DOM references ---
const dateInput = document.getElementById("date");
const timeSlotsContainer = document.getElementById("time-slots");
const confirmBtn = document.getElementById("confirm-booking");
const successMessage = document.getElementById("success-message");
const today = new Date();
if (dateInput) dateInput.min = today.toISOString().split("T")[0];

// Populate services select
function populateServiceSelect() {
  const select = document.getElementById("service");
  if (!select) return;
  select.innerHTML = '<option value="">-- Выберите услугу --</option>';
  serviceData.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.category;
    group.items.forEach(s => {
      const option = document.createElement("option");
      option.value = s.price;
      option.textContent = `${s.name} — ${s.price.toLocaleString()} ₽`;
      option.dataset.duration = s.duration;
      option.dataset.name = s.name;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });
}

// Fetch booked slots from server (returns Set of "HH:MM")
// Robust: поддерживает ответ как массив [{time:"HH:MM"}] или { success:true, bookings: [...] }
async function fetchBookedSet(date) {
  if (!date) return new Set();
  try {
    const res = await fetch(`/api/bookings?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    if (!res.ok) {
      console.warn('fetchBookedSet: bad response', res.status);
      return new Set();
    }
    const payload = await res.json();

    // payload может быть:
    // 1) массив: [{time: "10:30", ...}, ...]
    // 2) объект: { success: true, bookings: [...] }
    // 3) объект: { ... } — тогда попытаемся извлечь массив из payload.bookings или payload
    let arr = [];
    if (Array.isArray(payload)) {
      arr = payload;
    } else if (payload && Array.isArray(payload.bookings)) {
      arr = payload.bookings;
    } else if (payload && Array.isArray(payload.data)) { // запасной кейс
      arr = payload.data;
    } else {
      // возможно один объект — игнорируем
      arr = [];
    }

    const times = arr.map(r => (r && r.time) ? r.time : null).filter(Boolean);
    return new Set(times);
  } catch (e) {
    console.warn('fetchBookedSet error', e);
    return new Set();
  }
}

// Render timeslots using real bookings
async function generateTimeSlots() {
  try {
    console.log('generateTimeSlots start');
    if (!timeSlotsContainer) { console.error('timeSlotsContainer not found'); return; }
    if (!dateInput) { console.error('dateInput not found'); return; }

    const selectedDate = dateInput.value;
    console.log('selectedDate =', selectedDate);
    timeSlotsContainer.innerHTML = '';

    if (!selectedDate) {
      timeSlotsContainer.innerHTML = '<p style="color:var(--text-light); text-align:center">Выберите дату</p>';
      return;
    }

    const sd = new Date(selectedDate); sd.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    if (sd < t) {
      timeSlotsContainer.innerHTML = '<p style="color:var(--text-light); text-align:center">Выберите корректную дату</p>';
      return;
    }

    // loader
    const loader = document.createElement('div');
    loader.textContent = 'Загрузка слотов...';
    loader.style.textAlign = 'center';
    loader.style.color = 'var(--text-light)';
    timeSlotsContainer.appendChild(loader);

    const bookedSet = await fetchBookedSet(selectedDate);
    console.log('bookedSet =', Array.from(bookedSet));
    timeSlotsContainer.innerHTML = '';

    // generate slots 10:00 — 17:30
    for (let hour = 10; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.textContent = time;
        slot.dataset.time = time;
        if (bookedSet.has(time)) slot.classList.add('occupied');
        slot.addEventListener('click', () => {
          if (slot.classList.contains('occupied')) {
            slot.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { duration: 220 });
            return;
          }
          document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
          slot.classList.add('selected');
        });
        timeSlotsContainer.appendChild(slot);
      }
    }

    console.log('generateTimeSlots done');
  } catch (e) {
    console.error('generateTimeSlots fatal error', e);
    timeSlotsContainer.innerHTML = '<p style="color:var(--text-light); text-align:center">Ошибка загрузки слотов</p>';
  }
}

// Utilities
function sanitizePhone(phone){ return phone.replace(/[^\d+]/g,"").trim(); }
function showSuccessMessage(){ successMessage && (successMessage.style.display = "block"); }
function closeSuccessMessage(){ successMessage && (successMessage.style.display = "none"); }
window.closeSuccessMessage = closeSuccessMessage;

// Booking submit handler with bot deep-link handling
confirmBtn?.addEventListener("click", async () => {
  try {
    const name = document.getElementById("name")?.value.trim() || "";
    const phoneRaw = document.getElementById("phone")?.value.trim() || "";
    const phone = sanitizePhone(phoneRaw);
    const date = dateInput?.value || "";
    const selectedTimeSlot = document.querySelector(".time-slot.selected");
    const serviceSelect = document.getElementById("service");
    const serviceOption = serviceSelect ? serviceSelect.options[serviceSelect.selectedIndex] : null;
    const serviceName = serviceOption?.dataset?.name || "";
    const servicePrice = serviceOption?.value || "";
    const serviceDuration = serviceOption?.dataset?.duration || "";

    const errors = [];
    if (!name || name.length < 2) errors.push("Имя должно быть не короче 2 символов");
    if (!phone || phone.length < 8) errors.push("Введите корректный телефон");
    if (!date) errors.push("Выберите дату");
    if (!selectedTimeSlot) errors.push("Выберите время");
    if (!serviceName || !servicePrice) errors.push("Выберите услугу");

    if (errors.length) { alert(errors.join("\n")); return; }

    const payload = { name, phone, date, time: selectedTimeSlot.dataset.time, serviceName, servicePrice, serviceDuration };

    confirmBtn.disabled = true;
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = "Отправка...";

    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.status === 409) {
      alert("Извините, выбранный слот уже занят. Обновляю список слотов.");
      await generateTimeSlots();
      return;
    }

    const data = await res.json().catch(()=>({success:false}));
    if (!data.success) { alert("Ошибка отправки заявки. Попробуйте позже."); return; }

    // success: mark slot occupied, show popup
    selectedTimeSlot.classList.remove("selected");
    selectedTimeSlot.classList.add("occupied");
    showSuccessMessage();

    // if server returned botDeepLink, open bot so user can press Start
    if (data.botDeepLink) {
      // open in new tab/window — user must press Start to link chat
      window.open(data.botDeepLink, "_blank");
      // show short instruction
      setTimeout(() => {
        alert("Чтобы получать напоминания в Telegram, откройте бота и нажмите Start. Если бот не открылся, откройте ссылку из новой вкладки.");
      }, 300);
    } else {
      // If no bot link available, inform user
      alert("Спасибо! Ваша запись подтверждена. Если хотите получать уведомления в Telegram, свяжитесь с администратором.");
    }

    document.getElementById("booking-form")?.reset();
    await generateTimeSlots();
  } catch (e) {
    console.error('booking send error', e);
    alert("Сеть недоступна. Проверьте соединение.");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = confirmBtn.getAttribute('data-original-text') || "Записаться";
    }
  }
});


// Accordion, gallery, nav (как раньше)
function initAccordion() {
  const headers = document.querySelectorAll(".accordion-header");
  headers.forEach(header => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const isActive = header.classList.contains("active");
      headers.forEach(h => { h.classList.remove("active"); h.nextElementSibling?.classList.remove("active"); });
      if (!isActive) { header.classList.add("active"); content.classList.add("active"); }
    });
  });
}

function initGallery() {
  const galleryItems = document.querySelectorAll(".gallery-item");
  const modal = document.getElementById("gallery-modal");
  const modalImage = document.getElementById("modal-image");
  const modalClose = document.querySelector(".modal-close");
  galleryItems.forEach(item => item.addEventListener("click", () => {
    const img = item.querySelector("img");
    if (!img) return;
    modalImage.src = img.src;
    modal.style.display = "flex";
  }));
  modalClose?.addEventListener("click", () => modal.style.display = "none");
  modal?.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
}

function initNav() {
  const nav = document.querySelector("nav");
  document.querySelectorAll("nav a").forEach(anchor => {
    anchor.addEventListener("click", function(e){
      e.preventDefault();
      const targetId = this.getAttribute("href");
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({ top: targetElement.offsetTop - 80, behavior: "smooth" });
        nav.classList.remove("active");
      }
    });
  });
  document.getElementById("book-now")?.addEventListener("click", () => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" }));
  document.getElementById("view-works")?.addEventListener("click", () => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" }));
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  populateServiceSelect();
  initAccordion();
  initGallery();
  initNav();
  // ensure slots refresh when date changes
  dateInput?.addEventListener('change', generateTimeSlots);
  // also regenerate when page loads (if date already present)
  generateTimeSlots();
});
