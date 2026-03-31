# 🚀 General DWG Request - Deployment Guide

**Date:** 2026-03-31  
**Target Server:** plbmp129 (Minebea Factory)  
**System:** ENG System - MTC Engineering

---

## 📋 Pre-Deployment Checklist

### Prerequisites
- [ ] PostgreSQL database running on server
- [ ] Node.js installed (v14 or higher)
- [ ] Backend port 2005 available
- [ ] Frontend build tools installed
- [ ] Database user credentials (eng_admin)

---

## 🔧 Step-by-Step Deployment

### Step 1: Database Migration

**Option A: Using pgAdmin (Recommended)**
1. Open pgAdmin and connect to PostgreSQL
2. Connect to `eng_system` database
3. Open Query Tool
4. Copy and paste contents from: `db/migrations/tool_request_constraints.sql`
5. Execute (F5 or lightning bolt icon)
6. Verify success - should see "Query returned successfully"

**Option B: Using PowerShell Script**
```powershell
cd C:\Users\lble485\Eng_Sys
.\db\migrations\run_migration.ps1
```

**Option C: Using psql command line**
```bash
psql -U postgres -d eng_system -f db/migrations/tool_request_constraints.sql
```

**Verify Migration:**
```sql
-- Check constraints
SELECT conname FROM pg_constraint WHERE conrelid = 'tr_request'::regclass;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'tr_request';

-- Check audit table
SELECT COUNT(*) FROM tr_request_audit;
```

---

### Step 2: Configure Backend Environment

1. Navigate to backend directory:
   ```
   cd C:\Users\lble485\Eng_Sys\apps\ENG-Backend
   ```

2. Edit `.env` file and update:
   ```env
   # Server
   PORT=2005
   SERVER_URL=http://plbmp129:2005
   NODE_ENV=production
   
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=eng_system
   DB_USER=eng_admin
   DB_PASSWORD=your_actual_password
   
   # JWT Secret (CHANGE THIS!)
   JWT_SECRET=plbmp129_production_secret_key_2026_change_this
   
   # Email Configuration
   GAS_EMAIL_URL=https://script.google.com/a/macros/minebea.co.th/s/YOUR_DEPLOYMENT_ID/s
   GAS_SECRET_KEY=ENG_DWG_2026
   
   # Email Recipients (update with actual emails)
   EMAIL_MTC_ENG_CHECK=engineer1@minebea.co.th,engineer2@minebea.co.th
   EMAIL_MTC_DRAFTMAN=draftman1@minebea.co.th
   EMAIL_MTC_DWG_CHECK=dwgchecker1@minebea.co.th
   EMAIL_MTC_ENG_REVIEW=reviewer1@minebea.co.th
   EMAIL_MTC_ENG_APPROVE=approver1@minebea.co.th
   EMAIL_MTC_ENG_INFORM=inform1@minebea.co.th
   ```

3. Create logs directory (if not exists):
   ```powershell
   mkdir C:\Users\lble485\Eng_Sys\apps\ENG-Backend\logs
   ```

---

### Step 3: Update Frontend Configuration

1. Open `apps/ENG-Frontend/src/constance/constance.js`

2. **Comment out** the development line:
   ```javascript
   // export const apiUrl = "http://localhost:2005/";
   ```

3. **Uncomment** the production line:
   ```javascript
   export const apiUrl = "http://plbmp129:2005/";
   ```

   **OR** replace the entire file with `constance_prod.js`:
   ```powershell
   Copy-Item `
     "C:\Users\lble485\Eng_Sys\apps\ENG-Frontend\src\constance\constance_prod.js" `
     "C:\Users\lble485\Eng_Sys\apps\ENG-Frontend\src\constance\constance.js"
   ```

---

### Step 4: Build Frontend

```powershell
cd C:\Users\lble485\Eng_Sys\apps\ENG-Frontend
npm install
npm run build
```

**Expected Output:**
```
Creating an optimized production build...
Compiled successfully.

File sizes after gzip:
  2.5 MB  build/static/js/main.js
  150 KB  build/static/css/main.css
```

---

### Step 5: Deploy to Production Server

**If deploying on same machine (plbmp129):**

1. Copy build files:
   ```powershell
   # Backend is already on server, just restart it
   # Frontend build is in apps/ENG-Frontend/build
   ```

2. Start/Restart backend server:
   ```powershell
   cd C:\Users\lble485\Eng_Sys\apps\ENG-Backend
   npm install
   npm start
   ```

**If deploying from development machine to plbmp129:**

1. Build locally:
   ```powershell
   cd apps/ENG-Frontend
   npm run build
   ```

2. Copy entire project to plbmp129:
   ```
   Destination: C:\Users\lble485\Eng_Sys\ (on plbmp129)
   ```

3. On plbmp129, start backend:
   ```powershell
   cd C:\Users\lble485\Eng_Sys\apps\ENG-Backend
   npm install
   npm start
   ```

---

### Step 6: Verify File Upload Directory

```powershell
# Create directory if not exists
mkdir "C:\Users\lble485\Eng_Sys\apps\ENG-Backend\files\tool_requests"

# Set permissions (if needed)
# Right-click folder > Properties > Security
# Add: IIS_IUSRS or NETWORK SERVICE with Modify permissions
```

---

### Step 7: Start Backend Server

**Option A: Direct Start (for testing)**
```powershell
cd C:\Users\lble485\Eng_Sys\apps\ENG-Backend
npm start
```

**Option B: Run as Windows Service (production)**

1. Install NSSM (Non-Sucking Service Manager):
   ```powershell
   # Download from: https://nssm.cc/download
   # Extract to: C:\Program Files\nssm\
   ```

2. Create service:
   ```powershell
   C:\Program Files\nssm\win64\nssm.exe install ENG-Backend
   ```

3. Configure service:
   - Path: `C:\Program Files\nodejs\node.exe`
   - Startup directory: `C:\Users\lble485\Eng_Sys\apps\ENG-Backend`
   - Arguments: `server.js`

4. Start service:
   ```powershell
   nssm start ENG-Backend
   ```

**Option C: Use PM2 (recommended for production)**

1. Install PM2:
   ```powershell
   npm install -g pm2
   ```

2. Start with PM2:
   ```powershell
   cd C:\Users\lble485\Eng_Sys\apps\ENG-Backend
   pm2 start server.js --name "ENG-Backend"
   pm2 save
   pm2 startup
   ```

---

### Step 8: Test the Deployment

**1. Test Backend API:**
```powershell
# Test health check
curl http://plbmp129:2005/api/engineer/mtc/tool-requests

# Test dashboard
curl http://plbmp129:2005/api/engineer/mtc/tool-requests/dashboard
```

**2. Test Frontend:**
- Open browser: `http://plbmp129:2005`
- Navigate to: `/eng/mtc_eng/tool-request`
- Verify page loads without errors

**3. Test Workflow:**
1. Create a new request
2. Fill in all required fields
3. Upload a test file (PDF, < 1MB)
4. Submit request
5. Verify request appears in list
6. Walk through all 6 workflow stages
7. Check email notifications at each stage

**4. Test File Upload/Download:**
1. Create request with attachment
2. View request details
3. Click on file link
4. Verify file downloads correctly

---

## 🔍 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:**
- Check PostgreSQL service is running
- Verify DB credentials in `.env`
- Check firewall allows port 5432

### Port 2005 Already in Use
```
Error: listen EADDRINUSE: address already in use :::2005
```
**Solution:**
```powershell
# Find process using port 2005
netstat -ano | findstr :2005

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### Email Not Sending
```
⚠️ GAS (old URL) failed, falling back to Gmail API
```
**Solution:**
- Verify GAS_URL is correct and deployed
- Check GAS_SECRET_KEY matches
- For Gmail API, verify GMAIL_REFRESH_TOKEN is valid

### Frontend Shows Blank Page
**Solution:**
- Check browser console for errors
- Verify `constance.js` has correct API URL
- Clear browser cache (Ctrl+Shift+Del)
- Rebuild frontend: `npm run build`

### File Upload Fails
```
Error: ENOENT: no such file or directory
```
**Solution:**
```powershell
# Create directory
mkdir "C:\Users\lble485\Eng_Sys\apps\ENG-Backend\files\tool_requests"

# Set permissions
# Right-click > Properties > Security > Edit
# Add: IIS_IUSRS or NETWORK SERVICE with Modify
```

---

## 📊 Post-Deployment Verification

### Database Checks
```sql
-- Count requests
SELECT COUNT(*) FROM tr_request WHERE deleted_at IS NULL;

-- Check workflow records
SELECT COUNT(*) FROM tr_workflow;

-- Verify audit trail
SELECT * FROM tr_request_audit ORDER BY changed_at DESC LIMIT 10;

-- Check constraints
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'tr_request'::regclass;
```

### Log Checks
```powershell
# View recent logs (if configured)
Get-Content "C:\Users\lble485\Eng_Sys\apps\ENG-Backend\logs\app.log" -Tail 50
```

### Performance Checks
- Page load time: < 3 seconds
- API response time: < 500ms
- File upload (1MB): < 5 seconds

---

## 🔐 Security Recommendations

### For Production Deployment

1. **Enable JWT Authentication:**
   - Uncomment middleware in `server.js`
   - Set strong JWT_SECRET in `.env`
   - Implement login endpoint

2. **HTTPS Configuration:**
   - Set up reverse proxy (nginx/IIS)
   - Configure SSL certificate
   - Redirect HTTP to HTTPS

3. **File Upload Security:**
   - Validate file types (already implemented)
   - Scan files for malware
   - Set file size limits

4. **Database Security:**
   - Use least-privilege database user
   - Enable SSL for DB connections
   - Regular backups

5. **Access Control:**
   - Implement RBAC (Role-Based Access Control)
   - Audit log access
   - Session timeout

---

## 📞 Support Contacts

**Technical Support:**
- Check logs: `apps/ENG-Backend/logs/`
- Review API docs: `apps/ENG-Backend/api/engineer/mtc/API_DOCUMENTATION.md`
- Database audit: `SELECT * FROM tr_request_audit`

**Emergency Rollback:**
```powershell
# Stop backend service
nssm stop ENG-Backend
# or
pm2 stop ENG-Backend

# Restore previous version
# (Keep backup of previous build)

# Restart
nssm start ENG-Backend
```

---

## ✅ Deployment Sign-Off

| Step | Status | Completed By | Date |
|------|--------|--------------|------|
| Database Migration | ☐ | | |
| Backend Configuration | ☐ | | |
| Frontend Build | ☐ | | |
| File Upload Setup | ☐ | | |
| Backend Start | ☐ | | |
| Testing | ☐ | | |
| Email Verification | ☐ | | |

---

**Deployment Complete!** 🎉

Access the system at: `http://plbmp129:2005/eng/mtc_eng/tool-request`
