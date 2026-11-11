const $=s=>document.querySelector(s), content=$("#content");
let state={faculty:[],subjects:[],rooms:[],timings:null,tt:null};
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||"Request failed.");return d}
function msg(e){alert(e.message||e)}
function formVal(form){return Object.fromEntries(new FormData(form))}
async function loadAll(){[state.faculty,state.subjects,state.rooms,state.timings,state.tt]=await Promise.all([
api("/api/hod/faculty").then(x=>x.users),api("/api/hod/subjects").then(x=>x.subjects),api("/api/hod/rooms").then(x=>x.rooms),api("/api/hod/timings"),api("/api/hod/timetable")]);}
function table(headers,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows||'<tr><td colspan="8" class="empty">No records yet.</td></tr>'}</tbody></table></div>`}
async function page(name){
 document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
 const titles={overview:"Dashboard",faculty:"Faculty Management",subjects:"Subject Management",rooms:"Room Management",timings:"Timing Management",timetable:"Manual Timetable Management",generator:"Automatic Timetable Generator"};
 $("#page-heading").textContent=titles[name]||"Dashboard";
 try{await loadAll(); if(name==="overview") await overview(); if(name==="faculty") facultyPage();if(name==="subjects")subjectsPage();if(name==="rooms")roomsPage();if(name==="timings")timingsPage();if(name==="timetable")timetablePage();if(name==="generator")generatorPage();}
 catch(e){content.innerHTML=`<div class="alert">${e.message}</div>`;}
}
async function overview(){
 const d=await api("/api/hod/overview");

 content.innerHTML=`
 <div class="stats-grid">
 ${[
 ["Total Faculty",d.faculty],
 ["Total Subjects",d.subjects],
 ["Total Classrooms",d.rooms],
 ["Timetable Entries",d.entries]
 ].map(x=>`
 <div class="stat-card">
 <span>${x[0]}</span>
 <strong>${x[1]}</strong>
 </div>`).join("")}
 </div>

 <section class="panel">
 <h2>Published Timetable</h2>
 ${table(
 ["Semester","Day","Time","Subject","Faculty","Room"],
 state.tt.entries.map(x=>`
 <tr>
 <td>${x.semester}</td>
 <td>${x.day}</td>
 <td>${x.start} – ${x.end}</td>
 <td>${x.subject}</td>
 <td>${x.faculty_name||"—"}</td>
 <td>${x.room_name||"—"}</td>
 </tr>`).join("")
 )}
 </section>`;
}
function facultyPage(){

 content.innerHTML=`
 <section class="panel">
 <h2>Register Faculty Account</h2>

 <p class="muted">
 Use the faculty member's real name, email and initial password.
 </p>

 <form id="faculty-form" class="form-grid">

 <label>Faculty Name
 <input name="name" required>
 </label>

 <label>Registered Email
 <input name="email" type="email" required>
 </label>

 <label>Initial Password
 <input name="password" type="password" minlength="8" required>
 </label>

 <button class="button primary">
 Add Faculty
 </button>

 </form>
 </section>

 <section class="panel">
 <h2>Registered Faculty</h2>

 ${table(
 ["Name","Email","Assigned Subjects","Action"],
 state.faculty.map(f=>`
 <tr>
 <td>${f.name}</td>
 <td>${f.email}</td>
 <td>${(f.subjects||[]).join(", ")||"Not assigned"}</td>
 <td class="table-actions">
 <button data-delete-faculty="${f.id}">
 Delete
 </button>
 </td>
 </tr>
 `).join("")
 )}
 </section>
 `;

 $("#faculty-form").onsubmit=async e=>{
 e.preventDefault();

 try{
 await api("/api/hod/faculty",{
 method:"POST",
 body:JSON.stringify(formVal(e.target))
 });

 alert("Faculty added successfully.");
 page("faculty");

 }catch(x){
 msg(x);
 }
 };

 content.querySelectorAll("[data-delete-faculty]").forEach(b=>{
 b.onclick=async()=>{

 if(confirm("Delete this faculty account?")){
 try{
 await api("/api/hod/faculty/"+b.dataset.deleteFaculty,{
 method:"DELETE"
 });

 page("faculty");

 }catch(e){
 msg(e);
 }
 }

 };
 });

}
function subjectsPage(){content.innerHTML=`<section class="panel"><h2>Add subject</h2><form id="subject-form" class="form-grid"><label>Semester<select name="semester"><option value="3">3rd Semester</option><option value="5">5th Semester</option></select></label><label>Subject name<input name="name" required></label><label>Assigned faculty name<input name="faculty_name" placeholder="Exact faculty name"></label><button class="button primary">Add Subject</button></form></section><section class="panel"><h2>Configured subjects</h2>${table(["Semester","Subject","Faculty"],state.subjects.map(s=>`<tr><td>${s.semester}</td><td>${s.name}</td><td>${s.faculty_name||"Not assigned"}</td></tr>`).join(""))}</section>`;$("#subject-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/hod/subjects",{method:"POST",body:JSON.stringify(formVal(e.target))});page("subjects")}catch(x){msg(x)}}}
function roomsPage(){content.innerHTML=`<section class="panel"><h2>Add classroom</h2><form id="room-form" class="form-grid"><label>Room number / name<input name="name" required placeholder="Enter actual room number"></label><label>Room capacity<input name="capacity" type="number" min="1" required></label><button class="button primary">Add Classroom</button></form></section><section class="panel"><h2>Classrooms</h2>${table(["Room","Capacity","Action"],state.rooms.map(r=>`<tr><td>${r.name}</td><td>${r.capacity}</td><td class="table-actions"><button data-delete-room="${r.id}">Delete</button></td></tr>`).join(""))}</section>`;$("#room-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/hod/rooms",{method:"POST",body:JSON.stringify(formVal(e.target))});page("rooms")}catch(x){msg(x)}};content.querySelectorAll("[data-delete-room]").forEach(b=>b.onclick=async()=>{if(confirm("Delete classroom?"))try{await api("/api/hod/rooms/"+b.dataset.deleteRoom,{method:"DELETE"});page("rooms")}catch(e){msg(e)}})}
function timingsPage(){let t=state.timings;content.innerHTML=`<section class="panel"><h2>Working days</h2><form id="timing-form"><div class="form-grid"><label>Working days (comma separated)<input name="days" value="${t.working_days.join(", ")}"></label></div><h2>Periods and break</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Start (24-hour)</th><th>End (24-hour)</th><th>Type</th></tr></thead><tbody>${t.periods.map((p,i)=>`<tr><td><input name="name${i}" value="${p.name}" required></td><td><input name="start${i}" value="${p.start}" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" required></td><td><input name="end${i}" value="${p.end}" required></td><td><select name="kind${i}"><option value="class" ${p.kind==="class"?"selected":""}>Class</option><option value="break" ${p.kind==="break"?"selected":""}>Break</option></select></td></tr>`).join("")}</tbody></table></div><button class="button primary" style="margin-top:15px">Save Timing Settings</button></form></section>`;
 $("#timing-form").onsubmit=async e=>{e.preventDefault();let f=new FormData(e.target),periods=t.periods.map((p,i)=>({name:f.get("name"+i),start:f.get("start"+i),end:f.get("end"+i),kind:f.get("kind"+i)}));try{await api("/api/hod/timings",{method:"POST",body:JSON.stringify({periods,working_days:f.get("days").split(",").map(x=>x.trim()).filter(Boolean)})});alert("Timings saved.");page("timings")}catch(x){msg(x)}}}
function timetablePage(){

 let opts=(a,v,label)=>a.map(x=>
 `<option value="${x[v]}">${x[label]}</option>`
 ).join("");

 content.innerHTML=`

 <section class="panel">
 <h2>Add Subject or Classroom</h2>

 <div class="form-grid">

 <form id="quick-subject-form">
 <h3>Add New Subject</h3>

 <label>Semester
 <select name="semester" required>
 <option value="3">3rd Semester</option>
 <option value="5">5th Semester</option>
 </select>
 </label>

 <label>Subject Name
 <input name="name" required>
 </label>

 <label>Assigned Faculty (optional)
 <input name="faculty_name">
 </label>

 <button class="button primary">Add Subject</button>
 </form>

 <form id="quick-room-form">
 <h3>Add New Classroom</h3>

 <label>Room Name
 <input name="name" required>
 </label>

 <label>Room Capacity
 <input name="capacity" type="number" min="1" required>
 </label>

 <button class="button primary">Add Classroom</button>
 </form>

 </div>
 </section>

 <section class="panel">
 <h2>Add / Edit Timetable Entry</h2>

 <form id="entry-form" class="form-grid">

 <input type="hidden" name="id">

 <label>Semester
 <select name="semester">
 <option value="3">3rd</option>
 <option value="5">5th</option>
 </select>
 </label>

 <label>Day
 <select name="day">
 ${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(x=>`<option>${x}</option>`).join("")}
 </select>
 </label>

 <label>Subject
 <select name="subject" required>
 </select>
 </label>

 <label>Faculty
 <select name="faculty_id" required>
 ${opts(state.faculty,"id","name")}
 </select>
 </label>

 <label>Classroom
 <select name="room_id" required>
 ${opts(state.rooms,"id","name")}
 </select>
 </label>

 <label>Start Time
 <input name="start" type="time" required>
 </label>

 <label>End Time
 <input name="end" type="time" required>
 </label>

 <button class="button primary" id="save-entry">
 Save Entry
 </button>

 </form>
 </section>

 <section class="panel">
 <h2>Published Timetable Entries</h2>

 ${table(
 ["Semester","Day","Time","Subject","Faculty","Room","Action"],
 state.tt.entries.map(x=>`
 <tr>
 <td>${x.semester}</td>
 <td>${x.day}</td>
 <td>${x.start}–${x.end}</td>
 <td>${x.subject}</td>
 <td>${x.faculty_name||"—"}</td>
 <td>${x.room_name||"—"}</td>
 <td class="table-actions">
 <button type="button" data-edit-entry="${x.id}">Edit</button>
 <button type="button" data-delete-entry="${x.id}">Delete</button>
 </td>
 </tr>`).join("")
 )}
 </section>
 `;

 const form=$("#entry-form");

 function updateSubjects(){
 const semester=form.elements.semester.value;
 const old=form.elements.subject.value;

 const subjects=state.subjects.filter(
 s=>String(s.semester)===String(semester)
 );

 form.elements.subject.innerHTML=
 subjects.map(s=>
 `<option value="${s.name}">${s.name}</option>`
 ).join("");

 if(subjects.some(s=>s.name===old)){
 form.elements.subject.value=old;
 }
 }

 updateSubjects();

 form.elements.semester.onchange=updateSubjects;

 // Add subject directly
 $("#quick-subject-form").onsubmit=async e=>{
 e.preventDefault();

 try{
 await api("/api/hod/subjects",{
 method:"POST",
 body:JSON.stringify(formVal(e.target))
 });

 alert("Subject added successfully.");
 await page("timetable");

 }catch(x){msg(x)}
 };

 // Add classroom directly
 $("#quick-room-form").onsubmit=async e=>{
 e.preventDefault();

 try{
 await api("/api/hod/rooms",{
 method:"POST",
 body:JSON.stringify(formVal(e.target))
 });

 alert("Classroom added successfully.");
 await page("timetable");

 }catch(x){msg(x)}
 };

 // Edit existing entry
 content.querySelectorAll("[data-edit-entry]").forEach(b=>{
 b.onclick=()=>{
 const x=state.tt.entries.find(
 e=>String(e.id)===b.dataset.editEntry
 );

 if(!x)return;

 form.elements.id.value=x.id;
 form.elements.semester.value=x.semester;

 updateSubjects();

 form.elements.day.value=x.day;
 form.elements.subject.value=x.subject;
 form.elements.faculty_id.value=x.faculty_id;
 form.elements.room_id.value=x.room_id;
 form.elements.start.value=x.start;
 form.elements.end.value=x.end;

 $("#save-entry").textContent="Update Entry";

 form.scrollIntoView({behavior:"smooth"});
 };
 });

 // Save or update timetable
 form.onsubmit=async e=>{
 e.preventDefault();

 const f=formVal(form);

 if(f.start>=f.end){
 alert("End time must be after start time.");
 return;
 }

 try{
 await api("/api/hod/timetable",{
 method:"POST",
 body:JSON.stringify({entry:f})
 });

 alert(f.id?
 "Entry updated successfully.":
 "Entry added successfully."
 );

 await page("timetable");

 }catch(x){msg(x)}
 };

 // Delete timetable entry
 content.querySelectorAll("[data-delete-entry]").forEach(b=>{
 b.onclick=async()=>{
 if(confirm("Delete timetable entry?")){
 try{
 await api(
 "/api/hod/timetable/"+b.dataset.deleteEntry,
 {method:"DELETE"}
 );

 await page("timetable");

 }catch(e){msg(e)}
 }
 };
 });

}
function generatorPage(){content.innerHTML=`<section class="panel"><h2>Automatic timetable generator</h2><p class="muted">The generator uses only registered faculty, configured rooms, subjects, working days and non-break periods. It creates a separate draft; the current timetable is not overwritten.</p><div class="alert">Automatic generation requires faculty accounts matching the subject assignments and at least one configured classroom. Review all draft entries before approval.</div><button id="generate" class="button primary">Generate Draft Timetable</button> <button id="approve" class="button secondary">Approve Draft</button><div id="generation-result"></div></section><section class="panel"><h2>Current draft entries (${state.tt.drafts.length})</h2>${table(["Semester","Day","Time","Subject","Faculty","Room"],state.tt.drafts.map(x=>`<tr><td>${x.semester}</td><td>${x.day}</td><td>${x.start}–${x.end}</td><td>${x.subject}</td><td>${x.faculty_name}</td><td>${x.room_name}</td></tr>`).join(""))}</section>`;
 $("#generate").onclick=async()=>{try{let d=await api("/api/hod/generate",{method:"POST",body:"{}"});$("#generation-result").innerHTML=`<div class="alert success-note">${d.message}<br>${(d.conflicts||[]).join("<br>")}</div>`;page("generator")}catch(e){msg(e)}};
 $("#approve").onclick=async()=>{if(confirm("Approve and publish the generated draft?"))try{let d=await api("/api/hod/approve",{method:"POST",body:"{}"});alert(d.message);page("generator")}catch(e){msg(e)}};
}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>page(b.dataset.page)));
$("#logout").onclick=async()=>{await fetch("/api/logout",{method:"POST"});location.href="/";};
(async()=>{try{let d=await api("/api/me");if(d.role!=="hod")throw Error("HOD access only.");$("#user-name").textContent=d.user.name;page("overview")}catch(e){location.href="/hod-login"}})();
