# คู่มือการติดตั้งและตั้งค่าระบบ EngineerSystem ให้เหมือนเครื่องปัจจุบัน 100%
**EngineerSystem — Comprehensive Environment Setup & Server Sync Guide**

คู่มือนี้จัดทำขึ้นเพื่อให้คุณสามารถนำโปรเจกต์ **EngineerSystem** ไปติดตั้งและเปิดใช้งานบนเครื่องคอมพิวเตอร์เครื่องใหม่ (Windows) ได้ผลลัพธ์เหมือนกับเครื่องที่ใช้งานอยู่ปัจจุบัน (`PLBMP129`) ทุกประการ โดยครอบคลุมทั้งแบบ **1-Click อัตโนมัติ** ผ่านไฟล์ `.cmd` และแบบ **Manual Step-by-Step**

---

## 1. ข้อมูลระบบและสเปกเครื่องปัจจุบัน (Current Baseline Specifications)

| รายการ | ค่าที่ใช้งานปัจจุบันบนเครื่องแม่แบบ (`PLBMP129`) | หมายเหตุ |
| :--- | :--- | :--- |
| **ระบบปฏิบัติการ (OS)** | Windows 10 / 11 64-bit | |
| **Node.js** | `v22.22.0` (รองรับ Node 20 LTS หรือ 22) | ติดตั้งแบบ Standard พร้อมเพิ่มเข้า System PATH |
| **NPM** | `v10.9.4` | |
| **Python** | `Python 3.14.0` (รองรับ Python 3.10 ขึ้นไป) | จำเป็นต้องติดตั้งพร้อมติ๊ก **"Add Python to PATH"** |
| **Python Packages** | `pypdf 6.4.2`, `PyMuPDF 1.26.7`, `pdf2image`, `pdfplumber` | ใช้สำหรับ PDF Hub (Unlock, Repair, Text extraction) |
| **Git Version** | `2.54.0.windows.1` | รองรับ SSH Command บนพอร์ต `2222` |
| **โครงสร้างโปรเจกต์** | **Monorepo (NPM Workspaces)** | Root Workspace คุม `apps/ENG-Backend` และ `apps/ENG-Frontend` |
| **Corporate Proxy** | `http://proxyth.bp.minebea.local:8080` | Proxy เครือข่ายภายในบริษัท Minebea |
| **Git Remote Server** | `ssh://git@plbmp130:2222/LE131/EngineerSystem.git` | เซิร์ฟเวอร์หลัก `plbmp130` (IP: `10.121.34.204`) |
| **Database หลัก (`eng_system`)** | PostgreSQL บน `plbmp130:6543` | ฐานข้อมูลกลางระบบ Engineer |
| **Database โรงงาน (`rodpc`, `rodqc`)** | PostgreSQL บน `plb018:5432` | IP: `10.121.1.18` |
| **Database เครื่องจักร (`maqdb`)** | PostgreSQL บน `plbmp00:5432` | IP: `10.121.1.34` |
| **พอร์ต Backend API** | `2005` (Localhost หรือตาม IP เครื่อง) | Express.js / Node.js |
| **พอร์ต Frontend Client** | `3000` (Localhost หรือตาม IP เครื่อง) | React / Webpack Dev Server |

---

## 2. วิธีที่ 1: ติดตั้งอัตโนมัติด้วย 1-Click Script (แนะนำที่สุด)

ระบบได้เตรียมไฟล์สคริปต์อัตโนมัติไว้ให้เรียบร้อยแล้ว คุณสามารถรันเพียงคำสั่งเดียว ระบบจะจัดการทุกอย่างให้เองตั้งแต่ต้นจนจบ:

### ขั้นตอนการรัน:
1. นำโฟลเดอร์โปรเจกต์ `EngineerSystem` ไปวางบนเครื่องใหม่ หรือ `git clone` มาไว้ที่เครื่องใหม่
2. ดับเบิลคลิกไฟล์:
   ```text
   setup_machine.cmd
   ```
   *(หรือเปิด Command Prompt / PowerShell ในโฟลเดอร์โปรเจกต์แล้วพิมพ์ `.\setup_machine.cmd`)*

### สิ่งที่สคริปต์ `setup_machine.cmd` จัดการให้อัตโนมัติ:
- ✅ **ตรวจสอบ Prerequisites:** ตรวจสอบว่าเครื่องมี Node.js, npm, Python, pip และ Git หรือไม่ หากขาดตัวไหนจะแจ้งเตือนพร้อมบอกลิงก์ดาวน์โหลด
- ✅ **สร้างไฟล์ `.env` อัตโนมัติ 100%:** คัดลอกค่าคอนฟิกจาก `.env.sample` ไปเป็น `.env` ในทั้ง 3 โฟลเดอร์ (Root, Backend, Frontend) ให้ทันที **โดยที่คุณไม่ต้องมานั่งคัดลอกหรือแก้ค่าเอง**
- ✅ **ตรวจจับและตั้งค่า Corporate Proxy:** หากเครื่องอยู่ในเครือข่าย Minebea ระบบจะเซ็ต `npm proxy` ให้อัตโนมัติ เพื่อป้องกันการดาวน์โหลดแพ็กเกจค้าง
- ✅ **ติดตั้ง NPM Dependencies ทั้งระบบ:** รัน `npm install` ที่ระดับ Root ซึ่งจะติดตั้ง Dependencies ของทั้ง Backend และ Frontend ในรอบเดียว
- ✅ **ติดตั้ง Python Libraries สำหรับ PDF Hub:** ติดตั้ง `pypdf`, `PyMuPDF`, `pdf2image`, `pdfplumber` ให้กับ Python ในเครื่องโดยอัตโนมัติ
- ✅ **ตรวจสอบคอนฟิก Frontend (`constance.js`):** ตรวจสอบและตั้งค่าให้ชี้ไปยัง API Backend อย่างถูกต้อง
- ✅ **ทดสอบการเชื่อมต่อไปยัง Database เซิร์ฟเวอร์:** ทดสอบ TCP Ping ไปยังเซิร์ฟเวอร์ `plbmp130` (พอร์ต 6543, 2222), `plb018` (5432) และ `plbmp00` (5432) และสรุปสถานะการเชื่อมต่อให้ทันที
- ✅ **เริ่มรันระบบทันที:** มีตัวเลือกถามเพื่อเปิดเซิร์ฟเวอร์ Dev (`npm run dev`) ในหน้าต่างใหม่ทันที

---

## 3. วิธีสั่ง Remote และโหลด / อัปเดตข้อมูลจาก Server (`remote_sync_server.cmd`)

หากต้องการสั่งตั้งค่า Git Remote และดึงโค้ดหรืออัปเดตข้อมูลล่าสุดจากเซิร์ฟเวอร์ `plbmp130`:

### ขั้นตอนการรัน:
ดับเบิลคลิกไฟล์:
```text
remote_sync_server.cmd
```
*(หรือเปิด Command Prompt แล้วรัน `.\remote_sync_server.cmd`)*

### การทำงานของสคริปต์:
1. ตรวจสอบการเชื่อมต่อเครือข่ายไปยังเซิร์ฟเวอร์ `plbmp130` ที่พอร์ต `2222` (Git) และ `6543` (Database)
2. ตรวจสอบและผูก Remote `origin` ไปที่:
   ```text
   ssh://git@plbmp130:2222/LE131/EngineerSystem.git
   ```
3. ทำการ `git fetch origin --prune` เพื่ออัปเดต Branch ทั้งหมดจากเซิร์ฟเวอร์
4. สั่ง `git pull` อัปเดต Branch ปัจจุบัน (เช่น `main`, `dev`, `mtc`) ให้เป็นเวอร์ชันล่าสุด
5. ตรวจสอบไฟล์ `.env` หากมีตัวไหนหายไป จะกู้คืนจาก `.env.sample` ให้อัตโนมัติ
6. หากมีการอัปเดตไฟล์ `package.json` จะรัน `npm install` ให้อัตโนมัติ

---

## 4. วิธีที่ 2: ติดตั้งทีละขั้นตอนอย่างละเอียด (Manual Step-by-Step)

หากคุณต้องการติดตั้งแบบ Manual ทีละขั้นตอน สามารถทำตามขั้นตอนต่อไปนี้ได้เลยครับ:

### ขั้นตอนที่ 1: ติดตั้งโปรแกรมพื้นฐาน (Prerequisites)
ติดตั้งโปรแกรม 3 ตัวนี้บนเครื่อง Windows:
1. **Node.js (เวอร์ชัน 20 หรือ 22 LTS):**
   - ดาวน์โหลด: [https://nodejs.org/](https://nodejs.org/)
   - รันตัวติดตั้งตามค่าเริ่มต้น
   - ตรวจสอบใน Command Prompt:
     ```cmd
     node -v
     npm -v
     ```
2. **Python (เวอร์ชัน 3.10 ขึ้นไป):**
   - ดาวน์โหลด: [https://www.python.org/downloads/](https://www.python.org/downloads/)
   - ⚠️ **สำคัญมาก:** ในหน้าต่างแรกของตัวติดตั้ง ให้ติ๊กถูกที่ช่อง **"Add Python to PATH"** ก่อนกด Install Now
   - ตรวจสอบใน Command Prompt:
     ```cmd
     python --version
     pip --version
     ```
3. **Git for Windows:**
   - ดาวน์โหลด: [https://git-scm.com/download/win](https://git-scm.com/download/win)
   - ติดตั้งตามค่า Default
   - ตรวจสอบ:
     ```cmd
     git --version
     ```

---

### ขั้นตอนที่ 2: ตั้งค่า Proxy (สำหรับเครื่องในเครือข่ายบริษัท Minebea)
หากเครื่องของคุณต้องออกอินเทอร์เน็ตผ่าน Proxy ของบริษัท ให้เปิด Command Prompt แล้วรันคำสั่งเหล่านี้:

```cmd
:: 1. ตั้งค่า Proxy สำหรับ NPM
npm config set proxy http://proxyth.bp.minebea.local:8080
npm config set https-proxy http://proxyth.bp.minebea.local:8080

:: 2. ตั้งค่า Environment Variables ชั่วคราว (หากจำเป็น)
set HTTP_PROXY=http://proxyth.bp.minebea.local:8080
set HTTPS_PROXY=http://proxyth.bp.minebea.local:8080
```

*(หมายเหตุ: หาก Proxy มีการถาม Authentication สามารถระบุในรูปแบบ `http://username:password@proxyth.bp.minebea.local:8080` ได้ตามต้องการ)*

---

### ขั้นตอนที่ 3: ดึง Source Code หรือวางโฟลเดอร์โปรเจกต์
หากดึงผ่าน Git:
```cmd
git clone ssh://git@plbmp130:2222/LE131/EngineerSystem.git
cd EngineerSystem
```
หรือหาก Copy ผ่าน Flash Drive / Shared Drive ให้นำโฟลเดอร์ `EngineerSystem` ทั้งหมดมาวางในไดรฟ์ที่ต้องการ (เช่น `D:\97_Projects\00_System\EngineerSystem` หรือ `C:\Projects\EngineerSystem`)

---

### ขั้นตอนที่ 4: สร้างและตรวจสอบไฟล์ `.env` จาก `.env.sample`
โปรเจกต์นี้มีไฟล์ `.env.sample` ที่เตรียมข้อมูลตรงกับเครื่องต้นฉบับไว้ให้แล้วครบทั้ง 3 โฟลเดอร์ เพียงคัดลอกไปเป็นชื่อ `.env`:

#### 1. ที่ Root โฟลเดอร์ (`EngineerSystem\.env`):
```cmd
copy .env.sample .env
```
เนื้อหาในไฟล์:
```env
PG_NEW_HOST=localhost
PG_NEW_PORT=6543
PG_NEW_DB=eng_system
PG_NEW_USER=eng_admin
PG_NEW_PASS=eng_secret_2026
```

#### 2. ที่ Backend โฟลเดอร์ (`apps/ENG-Backend/.env`):
```cmd
copy apps\ENG-Backend\.env.sample apps\ENG-Backend\.env
```
เนื้อหาในไฟล์:
```env
GMAIL_CLIENT_ID=47418366864-v0e2hou0bb6hsosh8gtdulp1prqa8jhp.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=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
GMAIL_REDIRECT_URI=http://plbmp129:2005/auth/google/callback
GMAIL_REFRESH_TOKEN=1//04RdvrrpaQ1A7CgYIARAAGAQSNwF-L9IreEjJigTIX0xiCJERn8rERob6WWE8gs0dv3hfYX7EAe2FxyDFqFryoV7waVoRMmJzY88
GAS_EMAIL_URL=https://script.google.com/a/macros/minebea.co.th/s/AKfycbwUQrPmEcyc3olb4TTBW3XxQ9D-iykOy-Hjx63I145jcqJ6TDAp7B-qg8MRY_u48Fv_nw/exec
GAS_DRIVE_URL=https://script.google.com/a/macros/minebea.co.th/s/AKfycbyeg7I4oCoNEX5K36D44IHG8O0iWOtsiBigO-eGqc9c9Twe8PYys0iLsrJXwydm4vdC/exec
GAS_EMAIL_WEBAPP=https://script.google.com/a/macros/minebea.co.th/s/AKfycbyBwUbuPNdv9hGJd5s_SjVynpVxW5hPe4I45CtDB614JMeEzEsJTjPw_-GQv7f41o-TIQ/exec
PROXY_HOST=proxyth.bp.minebea.local
PROXY_PORT=8080
PROXY_USER=lble131
PROXY_PASS=Eng789456123

# PostgreSQL eng_system (Docker port 6543)
PG_NEW_HOST=plbmp130
PG_NEW_PORT=6543
PG_NEW_DB=eng_system
PG_NEW_USER=eng_admin
PG_NEW_PASS=eng_secret_2026
PG_NEW_URL=postgresql://eng_admin:eng_secret_2026@plbmp130:6543/eng_system

# PostgreSQL RODPC (instance.js)
PG_RODPC_HOST=plb018
PG_RODPC_PORT=5432
PG_RODPC_DB=rodpc
PG_RODPC_USER=rodpc
PG_RODPC_PASSWORD=RODPC

# PostgreSQL MAQ (instance_maq.js)
PG_MAQ_HOST=plbmp00
PG_MAQ_PORT=5432
PG_MAQ_DB=maqdb
PG_MAQ_USER=lpb
PG_MAQ_PASSWORD=lpb

# PostgreSQL RODQC (instance_qc.js)
PG_RODQC_HOST=plb018
PG_RODQC_PORT=5432
PG_RODQC_DB=rodqc
PG_RODQC_USER=rodqc
PG_RODQC_PASSWORD=RODQC

JWT_SECRET=ENG_SYSTEM_SECRET_KEY
EXTERNAL_JOB_CHECK_API_KEY=9144a40a-3139-4c30-91d4-def7a2179a06
```

#### 3. ที่ Frontend โฟลเดอร์ (`apps/ENG-Frontend/.env`):
```cmd
copy apps\ENG-Frontend\.env.sample apps\ENG-Frontend\.env
```
เนื้อหาในไฟล์:
```env
BROWSER=none
GENERATE_SOURCEMAP=false
```

---

### ขั้นตอนที่ 5: ติดตั้ง Dependencies (NPM + Python)

#### 1. ติดตั้ง NPM ทั้งโปรเจกต์:
เปิด Command Prompt ที่โฟลเดอร์ Root (`EngineerSystem`):
```cmd
npm install
```
*(คำสั่งนี้จะลง Library ทั้งหมดให้กับ Root, Backend และ Frontend พร้อมกันทันที)*

#### 2. ติดตั้ง Python Libraries สำหรับระบบ PDF Hub:
เปิด Command Prompt แล้วรันคำสั่ง:
```cmd
pip install pypdf PyMuPDF pdf2image pdfplumber
```
*(ถ้าติด Proxy ให้ใส่คำสั่ง: `pip install --proxy http://proxyth.bp.minebea.local:8080 pypdf PyMuPDF pdf2image pdfplumber`)*

---

### ขั้นตอนที่ 6: ตรวจสอบการตั้งค่า Frontend API (`constance.js`)
เปิดไฟล์:
```text
apps/ENG-Frontend/src/constance/constance.js
```
ตรวจดูบรรทัดที่เป็น `export const apiUrl`:
- **หากรัน Dev บนเครื่องตัวเอง (แนะนำ):**
  ```javascript
  export const apiUrl = "http://localhost:2005/";
  ```
- **หากต้องการเปิดให้เครื่องอื่นในวงแลนเข้าใช้งานได้ด้วย:**
  ```javascript
  export const apiUrl = "http://<ชื่อเครื่องของคุณ>:2005/";
  // ตัวอย่างเช่น: export const apiUrl = "http://PLBMP129:2005/";
  ```
- **หากต้องการให้ Frontend ในเครื่องนี้ชี้ไปหาเซิร์ฟเวอร์ Production ส่วนกลาง:**
  ```javascript
  export const apiUrl = "http://plbmp130.lb.minebea.local:2005/";
  ```

---

### ขั้นตอนที่ 7: การเปิดใช้งานระบบ (Development Mode)
เปิด Terminal / Command Prompt ที่โฟลเดอร์ Root (`EngineerSystem`) แล้วสั่ง:
```cmd
npm run dev
```

ระบบจะสตาร์ท 2 เซอร์วิสพร้อมกัน:
1. **Backend Service:** รันผ่าน Nodemon ที่ `http://localhost:2005`
   - ทดสอบความพร้อมของระบบ: เปิดเบราว์เซอร์ไปที่ `http://localhost:2005/api/health` (ต้องตอบกลับเป็น `{"status":"ok"}`)
2. **Frontend Service:** รัน React Webpack ที่ `http://localhost:3000`
   - เข้าใช้งานหน้าเว็บผ่าน: `http://localhost:3000`

---

## 5. การตรวจสอบความพร้อมของระบบเครือข่ายและพอร์ต (Network Port Matrix)

ระบบ EngineerSystem มีการเชื่อมต่อกับหลายเซิร์ฟเวอร์ภายในบริษัท สามารถใช้คำสั่ง PowerShell ตรวจสอบสถานะการเชื่อมต่อได้ดังนี้:

| เครื่องปลายทาง | IP Address | พอร์ต | หน้าที่ / เซอร์วิส | คำสั่งทดสอบใน PowerShell |
| :--- | :--- | :--- | :--- | :--- |
| `plbmp130` | `10.121.34.204` | `6543` | PostgreSQL ฐานข้อมูลหลัก (`eng_system`) | `Test-NetConnection plbmp130 -Port 6543` |
| `plbmp130` | `10.121.34.204` | `2222` | Git Server Repository (SSH) | `Test-NetConnection plbmp130 -Port 2222` |
| `plbmp130` | `10.121.34.204` | `2005` | Production Backend API Service | `Test-NetConnection plbmp130 -Port 2005` |
| `plb018` | `10.121.1.18` | `5432` | PostgreSQL สำหรับระบบ RODPC และ RODQC | `Test-NetConnection plb018 -Port 5432` |
| `plbmp00` | `10.121.1.34` | `5432` | PostgreSQL สำหรับระบบ MAQ Machine | `Test-NetConnection plbmp00 -Port 5432` |
| `proxyth.bp.minebea.local` | - | `8080` | Proxy ออกอินเทอร์เน็ตของบริษัท | `Test-NetConnection proxyth.bp.minebea.local -Port 8080` |

---

## 6. การรันแบบ Production ด้วย Docker หรือ PM2

### วิธีที่ 1: รันผ่าน Docker Compose
โปรเจกต์นี้มีไฟล์ `docker-compose.yml` รองรับการรันแบบคอนเทนเนอร์:
```cmd
set DOCKER_BUILDKIT=0
docker-compose up -d --build
```
ระบบจะเปิด:
- Backend: `http://localhost:2005`
- Frontend (ผ่าน Nginx): `http://localhost:3000` (Map จากพอร์ต 80 ภายใน)

### วิธีที่ 2: รันผ่าน PM2 + Nginx บน Windows หรือ Ubuntu Server
1. **Build Frontend:**
   ```cmd
   npm run build --workspace=apps/ENG-Frontend
   ```
   จะได้ไฟล์ Static Web อยู่ในโฟลเดอร์ `apps/ENG-Frontend/build`
2. **รัน Backend ผ่าน PM2:**
   ```cmd
   cd apps/ENG-Backend
   pm2 start server.js --name "eng-backend"
   pm2 save
   ```

---

## 7. ปัญหาที่พบบ่อยและการแก้ไข (Troubleshooting & FAQs)

### 1. `npm install` ค้างนาน หรือขึ้นข้อความ Network Timeout / ETIMEDOUT
- **สาเหตุ:** ไม่ได้ตั้งค่า Proxy สำหรับเครือข่ายบริษัท
- **วิธีแก้:** รันคำสั่งตั้งค่า Proxy ของ NPM:
  ```cmd
  npm config set proxy http://proxyth.bp.minebea.local:8080
  npm config set https-proxy http://proxyth.bp.minebea.local:8080
  ```

### 2. Git แจ้งเตือน `Permission denied (publickey)` หรือเชื่อมต่อพอร์ต 2222 ไม่ได้
- **สาเหตุ:** ยังไม่มีการเพิ่ม SSH Key ในเครื่องใหม่ หรือไม่ได้ระบุพอร์ต `2222`
- **วิธีแก้:** 
  1. สร้าง SSH Key ด้วยคำสั่ง: `ssh-keygen -t ed25519`
  2. นำ Public Key ที่ได้ใน `C:\Users\<username>\.ssh\id_ed25519.pub` ไปใส่ในเซิร์ฟเวอร์ Git บน `plbmp130`
  3. ทดสอบการเชื่อมต่อ: `ssh -p 2222 git@plbmp130`

### 3. รัน `npm run dev` แล้ว Backend แจ้งว่าพอร์ต 2005 หรือ 3000 ถูกใช้งานอยู่ (EADDRINUSE)
- **สาเหตุ:** มี Process Node หรือ Nodemon ตัวเก่ารันค้างอยู่
- **วิธีแก้:** สั่งปิด Process ทั้งหมดผ่าน Command Prompt:
  ```cmd
  taskkill /F /IM node.exe
  ```
  หรือรัน `auto_update_and_run.cmd` ซึ่งมีระบบ Clean พอร์ต 2005/3000 อัตโนมัติในตัว

### 4. ระบบ PDF Hub แจ้งเตือน Unlock หรือ Repair ไม่สำเร็จ
- **สาเหตุ:** ในเครื่องใหม่ยังไม่ได้ติดตั้ง Python หรือยังไม่ได้ติดตั้ง `PyMuPDF` (`fitz`) / `pypdf`
- **วิธีแก้:** รันคำสั่งติดตั้ง Library:
  ```cmd
  pip install pypdf PyMuPDF pdf2image pdfplumber
  ```
  และทดสอบว่า Python เรียกใช้งานได้: `python -c "import fitz, pypdf; print('OK')"`

---

## 8. สรุปไฟล์สคริปต์ที่มีให้ใช้งานในโปรเจกต์

| ชื่อไฟล์ | การใช้งาน | คำอธิบาย |
| :--- | :--- | :--- |
| `setup_machine.cmd` | `.\setup_machine.cmd` | **สคริปต์ติดตั้งระบบอัตโนมัติบนเครื่องใหม่ (1-Click Setup)** |
| `remote_sync_server.cmd` | `.\remote_sync_server.cmd` | **สคริปต์เชื่อมต่อ Git Remote และ Pull ข้อมูลล่าสุดจาก `plbmp130`** |
| `auto_update_and_run.cmd` | `.\auto_update_and_run.cmd` | ตรวจสอบ Git อัปเดตล่าสุด เคลียร์พอร์ตค้าง และสตาร์ท Dev Server |
| `.env.sample` | ตัวอย่างคอนฟิก Root | สำหรับคัดลอกไปเป็น `.env` |
| `apps/ENG-Backend/.env.sample` | ตัวอย่างคอนฟิก Backend | เก็บข้อมูล Database, Proxy, Gmail OAuth, JWT |
| `apps/ENG-Frontend/.env.sample` | ตัวอย่างคอนฟิก Frontend | ตั้งค่า React Build (`BROWSER=none`) |
