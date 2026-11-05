const $=s=>document.querySelector(s);
const select=$("#semester-select"), container=$("#timetable-container");
const names={"3":"3rd Semester","5":"5th Semester"};
const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function fmt(t){let [h,m]=t.split(":").map(Number);return `${(h%12)||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;}
function render(data,sem){
  $("#semester-title").textContent=names[sem]+" Timetable";
  const entries=data.entries||[];
  let html='<table><thead><tr><th>Day</th><th>Class schedule (exact duration)</th><th>Break</th></tr></thead><tbody>';
  for(const day of days){
    const rows=entries.filter(x=>x.day===day).sort((a,b)=>a.start.localeCompare(b.start));
    html+=`<tr><td>${day}</td><td>${rows.length?rows.map(x=>`<div class="class-block"><strong>${x.subject}</strong><small>${fmt(x.start)} – ${fmt(x.end)}</small><small>${x.faculty_name||"Faculty not registered"}</small><small>${x.room_name||"Room not assigned"}</small></div>`).join(""):'—'}</td><td><div class="break-block">BREAK<br>01:00 – 01:50 PM</div></td></tr>`;
  }
  html+='</tbody></table>';container.innerHTML=html;
  $("#timing-note").textContent="Merged classes are shown once with their full start and end times. Empty classroom fields indicate that room details have not yet been entered by HOD.";
}
async function load(){
 const sem=select.value;container.innerHTML='<p class="muted">Loading timetable…</p>';
 try{const r=await fetch(`/api/public/timetable?semester=${sem}`);const d=await r.json();if(!r.ok)throw Error(d.error);render(d,sem);}
 catch(e){container.innerHTML=`<p class="muted">${e.message||"Unable to load timetable."}</p>`;}
}
select.value=new URLSearchParams(location.search).get("semester")==="5"?"5":"3";
select.addEventListener("change",()=>{history.replaceState({}, "",`?semester=${select.value}`);load();});load();
