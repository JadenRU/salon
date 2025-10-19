const form = document.querySelector('#booking-form');
form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.querySelector('#client-name').value;
    const phone = document.querySelector('#client-phone').value;
    const date = document.querySelector('#date').value;
    const service = document.querySelector('#service-select').selectedOptions[0].dataset.name;

    if(!name||!phone||!date){ alert('Заполните все поля'); return; }

    try{
        const res = await fetch('/api/book',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name,phone,date,time:'10:00',service})
        });
        const data = await res.json();
        alert(data.message);
        window.open('https://t.me/kosmetolognada?start=booking','_blank');
    }catch(err){
        alert('Ошибка отправки, попробуйте позже.');
        console.error(err);
    }
});
