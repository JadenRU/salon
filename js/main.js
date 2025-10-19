const dateInput=document.getElementById('date');
const timesEl=document.getElementById('times');
const confirmBtn=document.getElementById('confirm-book');
const serviceRows=document.querySelectorAll('#services-table tr');

function getSlotsForDate(dateStr){
  if(!dateStr) return [];
  const date=new Date(dateStr+'T00:00:00'); if(date.getDay()===0) return [];
  const slots=[];
  for(let h=10;h<18;h++){slots.push(`${String(h).padStart(2,'0')}:00`); slots.push(`${String(h).padStart(2,'0')}:30`);}
  // TODO: здесь можно блокировать занятые слоты
  return slots;
}

function renderSlots(){
  timesEl.innerHTML='';
  const slots=getSlotsForDate(dateInput.value);
  if(slots.length===0){ timesEl.innerHTML='<div class="tiny muted">Нет доступных слотов.</div>'; return;}
  slots.forEach(s=>{
    const btn=document.createElement('button'); btn.type='button'; btn.className='slot'; btn.textContent=s;
    btn.addEventListener('click', ()=>{document.querySelectorAll('.slot').forEach(x=>x.classList.remove('selected')); btn.classList.add('selected');});
    timesEl.appendChild(btn);
  });
}

dateInput.addEventListener('change', renderSlots);
dateInput.min=new Date().toISOString().split('T')[0];

confirmBtn.addEventListener('click', async ()=>{
  const name=document.getElementById('client-name').value.trim();
  const phone=document.getElementById('client-phone').value.trim();
  const date=dateInput.value;
  const time=document.querySelector('.slot.selected')?.textContent;
  const selectedRow=document.querySelector('#services-table tr.selected') || document.querySelector('#services-table tr');
  const serviceName=selectedRow.children[0].textContent;
  const price=Number(selectedRow.children[2].textContent.replace(/\D/g,''));
  if(!name||!phone||!date||!time){alert('Заполните все поля'); return;}
  const booking={id:Date.now(), name, phone, date, time, serviceName, price};

  await fetch('/api/book',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(booking)
  });

  window.open(`https://t.me/NadezhdaBeauty_Bot?start=${booking.id}`,'_blank');
  alert('Запись подтверждена! Чат с ботом открыт.');
});

// выбор услуги
serviceRows.forEach(row=>{
  row.addEventListener('click', ()=>{
    serviceRows.forEach(r=>r.classList.remove('selected'));
    row.classList.add('selected');
  });
});
