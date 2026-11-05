const $=s=>document.querySelector(s);
async function api(url){let r=await fetch(url),d=await r.json();if(!r.ok)throw Error(d.error);return d}
function fmt(t){let [h,m]=t.split(":").map(Number);return `${h%12||12}:${m} ${h>=12?"PM":"AM"}`}
function render(d){
 const entries=d.entries||[],days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
 $("#user-name").textContent=d.user.name;
 const subjects=[...new Set(entries.map(x=>x.subject))];
 let today=new Intl.DateTimeFormat("en-US",{weekday:"long"}).format(new Date());
 let todayClasses=entries.filter(x=>x.day===today).sort((a,b)=>a.start.localeCompare(b.start));
 const next=todayClasses.find(x=>x.start>new Date().toTimeString().slice(0,5));
 let html=`<div class="stats-grid"><div class="stat-card"><span>Assigned subjects</span><strong>${subjects.length}</strong></div><div class="stat-card"><span>Today's classes</span><strong>${todayClasses.length}</strong></div><div class="stat-card"><span>Next class</span><strong style="font-size:16px">${next?next.subject:"—"}</strong></div><div class="stat-card"><span>Registered email</span><strong style="font-size:13px;word-break:break-word">${d.user.email}</strong></div></div><section class="panel"><h2>My assigned subjects</h2><p class="muted">${subjects.join(" · ")||"No timetable assignments found yet."}</p></section><section class="panel"><h2>My weekly timetable</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Day</th><th>Start</th><th>End</th><th>Semester</th><th>Subject</th><th>Classroom</th></tr></thead><tbody>`;
 for(let day of days){let rows=entries.filter(x=>x.day===day).sort((a,b)=>a.start.localeCompare(b.start));for(let x of rows)html+=`<tr><td>${day}</td><td>${fmt(x.start)}</td><td>${fmt(x.end)}</td><td>${x.semester}</td><td>${x.subject}</td><td>${x.room_name||"Not assigned"}</td></tr>`;}
 html+="</tbody></table></div></section>";
 $("#content").innerHTML=html;
}
(async()=>{try{let d=await api("/api/faculty/schedule");render(d)}catch(e){location.href="/faculty-login"}})();
$("#logout").onclick=async()=>{await fetch("/api/logout",{method:"POST"});location.href="/";};
