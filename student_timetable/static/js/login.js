const $=s=>document.querySelector(s);
const path=location.pathname;
const params=new URLSearchParams(location.search);
let activeRole=path==="/hod-login"?"hod":"faculty";
function roleUI(){
 document.querySelectorAll(".role-tab").forEach(b=>b.classList.toggle("active",b.dataset.role===activeRole));
 $("#role").value=activeRole;
 $("#login-title").textContent=activeRole==="hod"?"HOD Sign In":"Faculty Sign In";
 $("#login-eyebrow").textContent=activeRole==="hod"?"ADMINISTRATOR PORTAL":"FACULTY PORTAL";
}
document.querySelectorAll(".role-tab").forEach(b=>b.addEventListener("click",()=>{activeRole=b.dataset.role;roleUI();}));
async function request(url,body){
 const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const d=await r.json();if(!r.ok)throw Error(d.error||"Request failed.");return d;
}
(async()=>{
 try{
  const r=await fetch("/api/status");const d=await r.json();
  if(d.user){location.href=d.user.role==="hod"?"/static/hod.html":"/static/faculty.html";return;}
  if(d.setup_required && path==="/hod-login"){
   $("#setup-panel").hidden=false;$("#login-panel").hidden=true;
  } else if(d.setup_required && path==="/setup"){
   $("#setup-panel").hidden=false;$("#login-panel").hidden=true;
  } else {$("#setup-panel").hidden=true;$("#login-panel").hidden=false;}
 }catch(e){$("#message").textContent="Cannot connect to the local server.";}
 roleUI();
})();
$("#setup-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.target);
 try{const d=await request("/api/setup",Object.fromEntries(f));$("#message").className="message success";$("#message").textContent=d.message;$("#setup-panel").hidden=true;$("#login-panel").hidden=false;activeRole="hod";roleUI();}
 catch(err){$("#message").textContent=err.message;}
});
$("#login-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.target);
 try{const d=await request("/api/login",Object.fromEntries(f));location.href=d.role==="hod"?"/static/hod.html":"/static/faculty.html";}
 catch(err){$("#message").textContent=err.message;}
});
