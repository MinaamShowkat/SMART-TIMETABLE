# SMART TIMETABLE
**Kashmir Government Polytechnic Srinagar**  
**Department of Information Technology**

A local browser-based Student Timetable & Teacher Management System built with HTML, CSS, JavaScript, Python's built-in `http.server`, and JSON files. No Flask, Django, FastAPI, SQL, or external database is used.

## Requirements
- Windows 10/11
- Python 3.9 or newer
- A modern browser

## Run in VS Code
1. Extract the `student_timetable` folder.
2. Open that folder in VS Code.
3. Double-click `run.bat` in File Explorer, or run `python app.py` in the VS Code terminal.
4. `run.bat` starts the local server and opens the public homepage automatically.
5. Keep the server terminal/process running while using the application. Stop it with Ctrl+C in the server window.

The browser connects to a local Python server; the application is not a serverless/offline HTML-only site. The default address is `http://127.0.0.1:8000`, opened automatically by `run.bat`.

## First-time HOD setup
1. Open the application using `run.bat`.
2. Select **HOD Login** on the homepage.
3. On the first run, the setup form appears.
4. Enter the actual HOD name, official email and a private password (minimum 8 characters).
5. Sign in using those credentials.

No real HOD email or password is pre-created. Do not share the administrator password.

## Faculty setup
1. Sign in as HOD.
2. Open Faculty Management.
3. Add the faculty member's actual name, registered email and initial password.
4. Share the initial password securely with that faculty member.
5. Faculty signs in from the Faculty Login page.

Faculty emails/passwords and room numbers are intentionally not invented. The original timetable includes the supplied faculty names, while accounts and room assignments must be configured by HOD.

## Student access
Students do not register or log in. The homepage has direct links to the public 3rd and 5th Semester timetables. These pages are read-only.

## Included data
- Supplied 3rd Semester schedule and faculty-subject names.
- Supplied 5th Semester schedule and faculty-subject names.
- Monday-Saturday working days.
- Supplied period and break times.
- Empty room and user account lists until HOD configures actual information.

Timetable data is stored in `data/timetable.json`. Original entries preserve exact start/end times, including merged periods. Empty room labels mean a classroom has not yet been assigned; no room number is fabricated.

## JSON files
- `hod.json`: HOD account and password hash.
- `faculty.json`: faculty accounts and password hashes.
- `subjects.json`: semester subjects and supplied faculty names.
- `rooms.json`: classrooms entered by HOD.
- `timings.json`: periods, break and working days.
- `timetable.json`: published entries and separate generator drafts.
- `sessions.json`: expiring login sessions.

The app creates missing JSON files automatically. If a JSON file is corrupted, it is moved to a `.corrupt` backup where possible and a valid default file is restored. Back up the `data` folder before making manual edits.

## Security notes
Passwords are hashed with PBKDF2-HMAC-SHA256 and random salts. Session tokens are generated with Python's secure random generator and stored server-side; the cookie is HttpOnly and SameSite=Strict. Authorization is checked on the server. This is a local educational project, not hardened for public internet deployment. Use it on a trusted computer/network and do not expose port 8000 to the internet.

## Current implementation notes
- Public timetable viewing is available without student accounts.
- Faculty dashboard filters published schedule entries to the signed-in faculty account.
- HOD can add faculty accounts, subjects and rooms; manage timing settings; create/delete manual timetable entries; generate a separate draft; and approve a draft.
- The automatic generator requires real registered faculty accounts matching configured subject assignments and actual classroom records. If those details are missing, it reports the missing configuration rather than inventing data.
- Original entries are kept as published baseline data. Generator output is held separately until approval.
- Room capacity is recorded for HOD reference; class size is not supplied, so capacity matching cannot be inferred.

## Troubleshooting
- If the browser does not open, visit `http://127.0.0.1:8000` manually.
- If port 8000 is occupied, close the other local server and run again.
- If Python is not found, install Python and enable **Add Python to PATH**.
- Do not close the server process while the site is in use.
