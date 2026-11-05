import json, mimetypes, re, secrets, threading, time, webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote
from datetime import datetime
from config import BASE_DIR, DATA_DIR, STATIC_DIR, HOST, PORT, SESSION_COOKIE
from auth import hash_password, verify_password, new_session

LOCK = threading.RLock()
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

def read_json(name, default):
    path = DATA_DIR / name
    with LOCK:
        try:
            if not path.exists():
                write_json(name, default)
                return default
            with path.open("r", encoding="utf-8") as f:
                value = json.load(f)
            return value if isinstance(value, type(default)) else default
        except (OSError, json.JSONDecodeError):
            # Preserve a damaged file for inspection; restore a valid default.
            if path.exists():
                backup = path.with_suffix(path.suffix + ".corrupt")
                try: path.replace(backup)
                except OSError: pass
            write_json(name, default)
            return default

def write_json(name, value):
    path = DATA_DIR / name
    temp = path.with_suffix(path.suffix + ".tmp")
    with LOCK:
        with temp.open("w", encoding="utf-8") as f:
            json.dump(value, f, indent=2, ensure_ascii=False)
            f.flush()
        temp.replace(path)

def public_user(user):
    return {k:user.get(k) for k in ("id","name","email","subjects")}

def minutes(value):
    try:
        h,m = map(int, value.split(":"))
        if not (0 <= h <= 23 and 0 <= m <= 59): raise ValueError()
        return h*60+m
    except Exception:
        raise ValueError("Use a valid 24-hour time such as 10:00.")

def overlap(a,b):
    return minutes(a["start"]) < minutes(b["end"]) and minutes(b["start"]) < minutes(a["end"])

def all_entries(include_drafts=False):
    data=read_json("timetable.json",{"entries":[],"drafts":[]})
    return data["entries"] + (data.get("drafts",[]) if include_drafts else [])

class Handler(SimpleHTTPRequestHandler):
    server_version = "SmartTimetable/1.0"
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(BASE_DIR),**kwargs)
    def log_message(self, fmt, *args):
        print("[SMART TIMETABLE]", fmt % args)
    def send_json(self, code, payload, headers=None):
        body=json.dumps(payload,ensure_ascii=False).encode()
        self.send_response(code); self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(body))); self.send_header("Cache-Control","no-store")
        if headers:
            for k,v in headers.items(): self.send_header(k,v)
        self.end_headers(); self.wfile.write(body)
    def body(self):
        try:
            length=int(self.headers.get("Content-Length","0"))
            if length>1_000_000: raise ValueError()
            raw=self.rfile.read(length)
            return json.loads(raw or b"{}")
        except Exception:
            raise ValueError("Invalid request data.")
    def cookie(self):
        raw=self.headers.get("Cookie","")
        for part in raw.split(";"):
            k,_,v=part.strip().partition("=")
            if k==SESSION_COOKIE: return v
        return ""
    def current(self):
        token=self.cookie()
        if not token: return None
        data=read_json("sessions.json",{"sessions":[]})
        now=int(time.time())
        valid=[s for s in data["sessions"] if s.get("expires",0)>now]
        if len(valid)!=len(data["sessions"]): write_json("sessions.json",{"sessions":valid})
        return next((s for s in valid if secrets.compare_digest(s.get("token",""),token)),None)
    def require(self, role=None):
        s=self.current()
        if not s: self.send_json(401,{"error":"Please sign in."}); return None
        if role and s["role"]!=role:
            self.send_json(403,{"error":"You do not have permission to access this page."}); return None
        return s
    def do_GET(self):
        path=urlparse(self.path).path
        if path=="/api/status":
            h=read_json("hod.json",{"user":None})
            s=self.current()
            self.send_json(200,{"setup_required":not bool(h.get("user")),"user":None if not s else {"role":s["role"],"user_id":s["user_id"]}})
            return
        if path=="/api/public/timetable":
            q=__import__("urllib.parse").parse.parse_qs(urlparse(self.path).query)
            sem=q.get("semester",["3"])[0]
            if sem not in ("3","5"): self.send_json(400,{"error":"Invalid semester."}); return
            self.send_json(200,{"entries":[e for e in all_entries() if e["semester"]==sem and e.get("status")=="published"],
                "timings":read_json("timings.json",{})}); return
        if path=="/api/me":
            s=self.require()
            if s:
                if s["role"]=="hod":
                    u=read_json("hod.json",{}).get("user",{})
                    self.send_json(200,{"role":"hod","user":{"name":u.get("name"),"email":u.get("email")}})
                else:
                    users=read_json("faculty.json",{"users":[]})["users"]
                    u=next((x for x in users if x["id"]==s["user_id"]),None)
                    if not u: self.send_json(401,{"error":"Account not found."})
                    else: self.send_json(200,{"role":"faculty","user":public_user(u)})
            return
        if path.startswith("/api/"):
            s=self.require("hod") if path.startswith("/api/hod/") else self.require()
            if not s: return
            if path=="/api/hod/overview":
                self.send_json(200,{"faculty":len(read_json("faculty.json",{"users":[]})["users"]),
                    "subjects":len(read_json("subjects.json",{"subjects":[]})["subjects"]),
                    "rooms":len(read_json("rooms.json",{"rooms":[]})["rooms"]),
                    "entries":len(read_json("timetable.json",{"entries":[]})["entries"]) }); return
            if path=="/api/hod/faculty":
                self.send_json(200,read_json("faculty.json",{"users":[]})); return
            if path=="/api/hod/subjects":
                self.send_json(200,read_json("subjects.json",{"subjects":[]})); return
            if path=="/api/hod/rooms":
                self.send_json(200,read_json("rooms.json",{"rooms":[]})); return
            if path=="/api/hod/timings":
                self.send_json(200,read_json("timings.json",{})); return
            if path=="/api/hod/timetable":
                self.send_json(200,read_json("timetable.json",{"entries":[],"drafts":[]})); return
            if path=="/api/faculty/schedule":
                if s["role"]!="faculty": self.send_json(403,{"error":"Faculty access only."}); return
                users=read_json("faculty.json",{"users":[]})["users"]
                u=next((x for x in users if x["id"]==s["user_id"]),None)
                if not u: self.send_json(404,{"error":"Faculty account not found."}); return
                entries=[e for e in all_entries() if e.get("status")=="published" and
                    (e.get("faculty_id")==u["id"] or (not e.get("faculty_id") and e.get("faculty_name")==u["name"]))]
                self.send_json(200,{"user":public_user(u),"entries":entries,"timings":read_json("timings.json",{})}); return
            self.send_json(404,{"error":"API endpoint not found."}); return
        if path=="/": path="/templates/index.html"
        elif path in ("/faculty-login","/hod-login","/setup"): path="/templates/login.html"
        elif path=="/favicon.ico": self.send_error(404); return
        if path.startswith("/templates/") or path.startswith("/static/"):
            self.path=path
            return super().do_GET()
        self.send_error(404)
    def do_POST(self):
        path=urlparse(self.path).path
        try: data=self.body()
        except ValueError as e: self.send_json(400,{"error":str(e)}); return
        if path=="/api/setup":
            hod=read_json("hod.json",{"user":None})
            if hod.get("user"): self.send_json(409,{"error":"HOD setup has already been completed."}); return
            name=str(data.get("name","")).strip(); email=str(data.get("email","")).strip().lower(); password=data.get("password","")
            if not name or not EMAIL_RE.match(email): self.send_json(400,{"error":"Enter a valid name and email."}); return
            try: record=hash_password(password)
            except ValueError as e: self.send_json(400,{"error":str(e)}); return
            hod["user"]={"id":"hod-"+secrets.token_hex(8),"name":name,"email":email,"password":record}
            write_json("hod.json",hod); self.send_json(201,{"message":"HOD account created. Please sign in."}); return
        if path=="/api/login":
            role=data.get("role"); email=str(data.get("email","")).strip().lower(); password=data.get("password","")
            if role not in ("hod","faculty") or not EMAIL_RE.match(email):
                self.send_json(400,{"error":"Enter a valid email and select an account type."}); return
            if role=="hod": user=read_json("hod.json",{"user":None}).get("user")
            else: user=next((u for u in read_json("faculty.json",{"users":[]})["users"] if u["email"]==email),None)
            if not user or user.get("email")!=email or not verify_password(password,user.get("password",{})):
                self.send_json(401,{"error":"Incorrect email or password."}); return
            sess=new_session(user["id"],role); sessions=read_json("sessions.json",{"sessions":[]})
            sessions["sessions"]=[x for x in sessions["sessions"] if x.get("user_id")!=user["id"]]+[sess]
            write_json("sessions.json",sessions)
            self.send_json(200,{"message":"Signed in.","role":role}, {"Set-Cookie":f"{SESSION_COOKIE}={sess['token']}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800"})
            return
        if path=="/api/logout":
            token=self.cookie(); d=read_json("sessions.json",{"sessions":[]})
            d["sessions"]=[s for s in d["sessions"] if not secrets.compare_digest(s.get("token",""),token)]
            write_json("sessions.json",d)
            self.send_json(200,{"message":"Signed out."},{"Set-Cookie":f"{SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"}); return
        s=self.require("hod")
        if not s: return
        if path=="/api/hod/faculty":
            name=str(data.get("name","")).strip(); email=str(data.get("email","")).strip().lower(); password=data.get("password","")
            if not name or not EMAIL_RE.match(email): self.send_json(400,{"error":"Enter faculty name and valid email."}); return
            d=read_json("faculty.json",{"users":[]})
            if any(u["email"]==email for u in d["users"]): self.send_json(409,{"error":"That email is already registered."}); return
            try: pw=hash_password(password)
            except ValueError as e: self.send_json(400,{"error":str(e)}); return
            u={"id":"fac-"+secrets.token_hex(8),"name":name,"email":email,"password":pw,"subjects":[]}
            d["users"].append(u); write_json("faculty.json",d)
            self.send_json(201,{"faculty":public_user(u)}); return
        if path=="/api/hod/rooms":
            name=str(data.get("name","")).strip()
            try: capacity=int(data.get("capacity"))
            except Exception: capacity=0
            d=read_json("rooms.json",{"rooms":[]})
            if not name or capacity<1: self.send_json(400,{"error":"Enter a room number and positive capacity."}); return
            if any(r["name"].lower()==name.lower() for r in d["rooms"]): self.send_json(409,{"error":"Room already exists."}); return
            room={"id":"room-"+secrets.token_hex(6),"name":name,"capacity":capacity}
            d["rooms"].append(room); write_json("rooms.json",d); self.send_json(201,{"room":room}); return
        if path=="/api/hod/subjects":
            name=str(data.get("name","")).strip(); sem=str(data.get("semester",""))
            faculty_name=str(data.get("faculty_name","")).strip()
            if sem not in ("3","5") or not name: self.send_json(400,{"error":"Enter a subject and valid semester."}); return
            d=read_json("subjects.json",{"subjects":[]})
            if any(x["semester"]==sem and x["name"].lower()==name.lower() for x in d["subjects"]):
                self.send_json(409,{"error":"Subject already exists in this semester."}); return
            item={"id":"sub-"+secrets.token_hex(6),"semester":sem,"name":name,"faculty_name":faculty_name}
            d["subjects"].append(item); write_json("subjects.json",d); self.send_json(201,{"subject":item}); return
        if path=="/api/hod/timings":
            periods=data.get("periods"); working=data.get("working_days")
            if not isinstance(periods,list) or not isinstance(working,list) or not working or any(x not in DAYS for x in working):
                self.send_json(400,{"error":"Provide valid periods and working days."}); return
            try:
                ordered=sorted(periods,key=lambda x:minutes(x["start"]))
                for p in ordered:
                    if minutes(p["start"])>=minutes(p["end"]): raise ValueError("Period end must be after start.")
                for a,b in zip(ordered,ordered[1:]):
                    if minutes(a["end"])>minutes(b["start"]): raise ValueError("Periods cannot overlap.")
            except (ValueError,KeyError) as e: self.send_json(400,{"error":str(e)}); return
            write_json("timings.json",{"periods":periods,"working_days":working})
            self.send_json(200,{"message":"Timing settings saved."}); return
        if path=="/api/hod/timetable":
            entry=data.get("entry",{})
            try:
                sem=str(entry.get("semester")); day=entry.get("day")
                start,end=entry.get("start"),entry.get("end")
                if sem not in ("3","5") or day not in DAYS: raise ValueError("Select a valid semester and day.")
                if minutes(start)>=minutes(end): raise ValueError("End time must be after start time.")
                subject=str(entry.get("subject","")).strip()
                faculty_id=str(entry.get("faculty_id","")).strip()
                room_id=str(entry.get("room_id","")).strip()
                users=read_json("faculty.json",{"users":[]})["users"]
                rooms=read_json("rooms.json",{"rooms":[]})["rooms"]
                subs=read_json("subjects.json",{"subjects":[]})["subjects"]
                faculty=next((u for u in users if u["id"]==faculty_id),None)
                room=next((r for r in rooms if r["id"]==room_id),None)
                if not subject or not faculty or not room: raise ValueError("Select an existing subject, registered faculty and classroom.")
                if not any(x["semester"]==sem and x["name"]==subject for x in subs): raise ValueError("Subject is not configured for this semester.")
                new={"id":entry.get("id") or "entry-"+secrets.token_hex(7),"semester":sem,"section":"A","day":day,
                     "subject":subject,"faculty_id":faculty["id"],"faculty_name":faculty["name"],
                     "room_id":room["id"],"room_name":room["name"],"start":start,"end":end,"status":"published","source":"manual"}
                td=read_json("timetable.json",{"entries":[],"drafts":[]})
                for old in td["entries"]:
                    if old["id"]==new["id"]: continue
                    if old["day"]==day and overlap(old,new):
                        if old["faculty_id"]==faculty_id: raise ValueError("Faculty has another class at this time.")
                        if old["room_id"]==room_id: raise ValueError("Classroom is already booked at this time.")
                        if old["semester"]==sem: raise ValueError("This semester already has a class at this time.")
                existing=next((i for i,x in enumerate(td["entries"]) if x["id"]==new["id"]),None)
                if existing is None: td["entries"].append(new)
                else: td["entries"][existing]=new
                write_json("timetable.json",td); self.send_json(200,{"message":"Timetable entry saved.","entry":new}); return
            except (ValueError,KeyError) as e: self.send_json(400,{"error":str(e)}); return
        if path=="/api/hod/generate":
            td=read_json("timetable.json",{"entries":[],"drafts":[]})
            subs=read_json("subjects.json",{"subjects":[]})["subjects"]
            users=read_json("faculty.json",{"users":[]})["users"]
            rooms=read_json("rooms.json",{"rooms":[]})["rooms"]
            timing=read_json("timings.json",{"periods":[],"working_days":DAYS})
            if not users or not rooms:
                self.send_json(400,{"error":"Automatic generation needs registered faculty accounts and configured classrooms. Add these first; no details will be invented."}); return
            periods=[p for p in timing["periods"] if p.get("kind")!="break"]
            generated=[]; conflicts=[]
            for sem in ("3","5"):
                for sub in [x for x in subs if x["semester"]==sem]:
                    possible=[u for u in users if u["name"]==sub.get("faculty_name") or sub["name"] in u.get("subjects",[])]
                    if not possible:
                        conflicts.append(f"No registered faculty account assigned to {sub['name']} (Semester {sem})."); continue
                    placed=False
                    for day in timing["working_days"]:
                        for p in periods:
                            candidate={"semester":sem,"day":day,"start":p["start"],"end":p["end"],"faculty_id":possible[0]["id"]}
                            busy=td["entries"]+generated
                            if any(e["day"]==day and overlap(e,candidate) and
                                   (e.get("faculty_id")==candidate["faculty_id"] or e.get("semester")==sem)
                                   for e in busy): continue
                            room=next((r for r in rooms if not any(e["day"]==day and e.get("room_id")==r["id"] and overlap(e,candidate) for e in busy)),None)
                            if not room: continue
                            generated.append({"id":"draft-"+secrets.token_hex(6),"semester":sem,"section":"A","day":day,
                                "subject":sub["name"],"faculty_id":possible[0]["id"],"faculty_name":possible[0]["name"],
                                "room_id":room["id"],"room_name":room["name"],"start":p["start"],"end":p["end"],
                                "status":"draft","source":"automatic"})
                            placed=True; break
                        if placed: break
                    if not placed: conflicts.append(f"No conflict-free slot found for {sub['name']} (Semester {sem}).")
            td["drafts"]=generated; write_json("timetable.json",td)
            self.send_json(200,{"message":f"Generated {len(generated)} draft entries. Review before approval.","drafts":generated,"conflicts":conflicts}); return
        if path=="/api/hod/approve":
            td=read_json("timetable.json",{"entries":[],"drafts":[]})
            if not td["drafts"]: self.send_json(400,{"error":"There is no generated draft to approve."}); return
            # Keep existing original timetable; only append validated draft rows that do not conflict.
            for d in td["drafts"]:
                if any(e["day"]==d["day"] and overlap(e,d) and
                       (e.get("faculty_id")==d.get("faculty_id") or e.get("room_id")==d.get("room_id") or e.get("semester")==d.get("semester"))
                       for e in td["entries"]):
                    self.send_json(409,{"error":"Draft conflicts with the current published timetable. Review or clear the draft first."}); return
            for d in td["drafts"]: d["status"]="published"
            td["entries"].extend(td["drafts"]); td["drafts"]=[]
            write_json("timetable.json",td); self.send_json(200,{"message":"Draft timetable approved and published."}); return
        self.send_json(404,{"error":"API endpoint not found."})
    def do_DELETE(self):
        path=urlparse(self.path).path
        s=self.require("hod")
        if not s:return
        parts=path.strip("/").split("/")
        if len(parts)==4 and parts[:3]==["api","hod","faculty"]:
            d=read_json("faculty.json",{"users":[]}); before=len(d["users"])
            d["users"]=[u for u in d["users"] if u["id"]!=parts[3]]
            if len(d["users"])==before:self.send_json(404,{"error":"Faculty not found."});return
            write_json("faculty.json",d)
            # Clear sessions belonging to the removed account.
            sd=read_json("sessions.json",{"sessions":[]});sd["sessions"]=[x for x in sd["sessions"] if x["user_id"]!=parts[3]];write_json("sessions.json",sd)
            self.send_json(200,{"message":"Faculty account deleted."});return
        if len(parts)==4 and parts[:3]==["api","hod","rooms"]:
            d=read_json("rooms.json",{"rooms":[]}); before=len(d["rooms"]); d["rooms"]=[x for x in d["rooms"] if x["id"]!=parts[3]]
            if len(d["rooms"])==before:self.send_json(404,{"error":"Room not found."});return
            write_json("rooms.json",d);self.send_json(200,{"message":"Room deleted."});return
        if len(parts)==4 and parts[:3]==["api","hod","timetable"]:
            d=read_json("timetable.json",{"entries":[],"drafts":[]}); before=len(d["entries"])
            d["entries"]=[x for x in d["entries"] if x["id"]!=parts[3]]
            if len(d["entries"])==before:self.send_json(404,{"error":"Entry not found."});return
            write_json("timetable.json",d);self.send_json(200,{"message":"Timetable entry deleted."});return
        self.send_json(404,{"error":"API endpoint not found."})

def main():
    DATA_DIR.mkdir(exist_ok=True)
    server=ThreadingHTTPServer((HOST,PORT),Handler)
    print(f"SMART TIMETABLE running at http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop the server.")
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=="__main__": main()
