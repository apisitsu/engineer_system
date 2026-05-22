const express = require("express");
const http = require("http");
const path = require("path");
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const bodyParser = require("body-parser");
const cors = require("cors");

const fileupload = require("express-fileupload");

const app = express();
app.use(express.json());
var jsonParser = bodyParser.json();
var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(bodyParser.json({ limit: '50mb' })); //ทำให้ API เห็น body ได้
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb', }));

app.use(express.static(path.join(__dirname, "./files")));
app.use(jsonParser);
app.use(urlencodedParser);
app.use(cors()); //ทำให้ FrontEnd ต่อ server ได้
app.use(express.static("files"));

app.use(express.static("files"));

// Port & HTTP Server with WebSocket
const PORT = process.env.PORT || 2005;
const server = http.createServer(app);

// Setup WebSocket (socket.io)
const { setupWebSocket } = require('./api/kanban/websocket');
const io = setupWebSocket(server);
app.set('io', io); // Make io accessible in routes via req.app.get('io')

server.listen(PORT, () => {
  console.log(`Backend is running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});

// For Test
app.use(express.static('public'));
app.get("/", (req, res) => {
  // ใช้ Backticks (`) เพื่อเขียน HTML หลายบรรทัด
  const secretHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>⚠️ TOP SECRET: EYES ONLY</title>
          <style>
              body {
                  font-family: 'Sarabun', sans-serif;
                  background-color: #1a1a1d; /* สีพื้นหลังมืดๆ ดูลึกลับ */
                  color: #c5c6c7; /* สีตัวอักษร */
                  padding: 20px;
                  line-height: 1.6;
                  max-width: 800px;
                  margin: 0 auto;
              }
              h1 {
                  color: #da291c; /* สีแดงเข้มสำหรับหัวข้อลับ */
                  text-align: center;
                  text-transform: uppercase;
                  letter-spacing: 2px;
                  border-bottom: 2px solid #da291c;
                  padding-bottom: 15px;
              }
              h3 { color: #66fcf1; margin-top: 30px;}
              .evidence-img {
                  width: 100%;
                  max-height: 400px;
                  object-fit: cover;
                  border-radius: 5px;
                  border: 3px solid #da291c;
                  margin: 20px 0;
                  filter: sepia(40%) contrast(120%); /* แต่งรูปให้ดูเก่าและขลัง */
              }
              .highlight { color: #66fcf1; font-weight: bold; }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
      </head>
      <body>
          <h1>📄 แฟ้มลับสุดยอด: รหัสแดง</h1>
          <p><strong>คำเตือน:</strong> ข้อมูลที่คุณกำลังจะอ่านต่อไปนี้ เป็นความลับระดับชาติที่ถูกปกปิดมากว่าหนึ่งร้อยปี การเผยแพร่ข้อมูลนี้อาจสั่นคลอนประวัติศาสตร์ไทย</p>
  
          <img src="/image_m.png" alt="ภาพประกอบความลับ" class="evidence-img">
          <p><em>(ภาพจำลองเหตุการณ์: บรรยากาศความลึกลับในสยามยุคเก่า)</em></p>
  
          <h3>🌑 เปิดตำนานที่สาบสูญ: กระทรวงแพทยาคม</h3>
          <p>คุณเคยสงสัยไหมว่า ประวัติศาสตร์ที่เราเรียนกันมานั้น... คือความจริงทั้งหมด หรือเป็นเพียง "ฉากหน้า" ที่ถูกสร้างขึ้น?</p>
          
          <p>หลักฐานชิ้นสำคัญที่เพิ่งถูกขุดค้นพบชี้ว่า ในอดีตสยามประเทศเคยมีหน่วยงานราชการลับที่มีสถานะเทียบเท่ากระทรวงเวทมนตร์ มันถูกขนานนามอย่างเป็นทางการว่า <span class="highlight">"กระทรวงแพทยาคม"</span></p>
  
          <p>ฟังดูเผินๆ อาจเหมือนหน่วยงานการแพทย์รักษาโรคทั่วไป แต่เมื่อเจาะลึกลงไปในพันธกิจของกระทรวงนี้ กลับพบความจริงที่น่าขนลุก หน้าที่ของพวกเขาไม่ใช่การจ่ายยา แต่คือการจัดการกับคุณไสย มนต์ดำ การไล่ภูตผีปีศาจ และการใช้วิชาอาคมเพื่อปกป้องราชอาณาจักร!</p>
  
          <h3>🧙‍♂️ หรือว่า "พวกเขา" ยังอยู่ท่ามกลางเรา?</h3>
          <p>การมีอยู่ของกระทรวงแพทยาคมในอดีต ตั้งคำถามที่น่าหวาดหวั่น: เป็นไปได้หรือไม่ว่าการยุบกระทรวงเป็นเพียงการจัดฉาก? และแท้จริงแล้วเหล่าผู้ใช้อาคม พ่อมดแม่มดสัญชาติไทย ยังคงแฝงตัวใช้ชีวิตปะปนอยู่กับพวกเราในสังคมปัจจุบัน... โดยที่เราไม่รู้ตัว</p>
  
          <p style="text-align: center; margin-top: 40px; color: #da291c;"><strong>[ จบรายงานลับ ]</strong></p>
      </body>
      </html>
    `;

  // ส่งข้อมูลกลับเป็นหน้าเว็บ HTML
  res.send(secretHtml);
});

// --- Verify Token Middleware Setup ---
const { verifyToken } = require('./middleware/auth');

// Allow public access to login and refresh token, protect everything else under /api
app.use('/api', (req, res, next) => {
  if (req.path === '/login-user' || req.path === '/refresh-token' || req.path === '/proxy/job_check' || req.path.startsWith('/public')) {
    return next();
  }

  return verifyToken(req, res, next);
});

//--------------------System Engineer (PDF Converter)---------------------//
const pdfConverter = require('./api/engineer/system/pdfConverter');
app.use('/api/engineer/system', pdfConverter);

//--------------------PDF Hub (Sign & Stamp)---------------------//
const pdfHubController = require('./api/engineer/system/pdfHubController');
app.use('/api/engineer/pdf-hub', pdfHubController);

// Global File Upload Middleware (for routes not using multer)
app.use(fileupload({ createParentPath: true, limits: { fileSize: 50 * 1024 * 1024 } }));

//--------------------Engineer Record (Rod End Request)---------------------//
// Must be AFTER fileupload middleware so req.files is available for sync uploads
const engRecordRoutes = require('./api/engineer/eng_record/engRecordRoutes');
app.use('/api/engineer/eng-record', engRecordRoutes);


//--------------------User----------------------//
const newProducts = require('./api/engineer/new_prod/tool');

app.route('/api/proxy/job_check').get(newProducts.getJobCheck);

//--------------------Template Tool (APQP Forms)---------------------//
const templateTool = require('./api/engineer/new_prod/templateToolController');

// Form Headers (Dashboard)
app.get('/api/engineer/new_prod/forms', verifyToken, templateTool.listForms);
app.post('/api/engineer/new_prod/forms', verifyToken, templateTool.createForm);
app.delete('/api/engineer/new_prod/forms/:id', verifyToken, templateTool.deleteForm);

// Form Data CRUD (generic for all form types)
app.get('/api/engineer/new_prod/forms/:formType/:id', verifyToken, templateTool.getFormData);
app.put('/api/engineer/new_prod/forms/:formType/:id', verifyToken, templateTool.saveFormData);
app.put('/api/engineer/new_prod/forms/:formType/:id/status', verifyToken, templateTool.updateFormStatus);

// Audit Trail
app.get('/api/engineer/new_prod/forms/:id/audit', verifyToken, templateTool.getAuditTrail);

// User Stamps
app.get('/api/engineer/new_prod/stamps/:em_id', verifyToken, templateTool.getStamp);
app.post('/api/engineer/new_prod/stamps', verifyToken, templateTool.upsertStamp);

// Calculator Usage Log
app.post('/api/engineer/new_prod/calc/log', verifyToken, templateTool.logCalcUsage);


//--------------------User----------------------//
const userController = require('./api/user/userModel');

app.route('/api/login-user').post(userController.LoginUser)
app.route('/api/get-all-users').get(userController.GetAllUsers)
app.route('/api/update-user-theme').post(userController.UpdateUserTheme)
app.route('/api/update-user-profile').post(userController.UpdateUserProfile)
app.route('/api/get-user-info').post(userController.GetUserInfo)
app.route('/api/refresh-token').post(userController.RefreshToken)


//------------------Process Engineer------------------//
const engProcess = require('./api/engineer/process/eng_process_model');
const engTumble = require('./api/engineer/process/eng_process_tumble');

app.route('/api/ecr/getlist').get(verifyToken, engProcess.ecrGetList)
app.route('/api/ecr/create').post(verifyToken, engProcess.ecrCreate)
app.route('/api/ecr/:id').get(verifyToken, engProcess.ecrGetById)
app.route('/api/ecr/:id/status').put(verifyToken, engProcess.ecrSubmitApproval)
app.get('/api/ecr/users-by-dept/:dept', verifyToken, engProcess.ecrGetUsersByDept);
app.put('/api/ecr/:id/resubmit', verifyToken, engProcess.ecrResubmit);
app.post('/api/ecr/:id/tasks', verifyToken, engProcess.ecrSetTasks);
app.get('/api/ecr/:id/tasks', verifyToken, engProcess.ecrGetTasks);
app.put('/api/ecr/tasks/:taskId/ack', verifyToken, engProcess.ecrAckTask);

// --------- Tumble System API ---------
// Tumble Model
app.route('/api/tumble/model/search').get(engTumble.getTumbleModelByOldCn);
app.route('/api/tumble/model')
  .get(engTumble.getAllTumbleModel)
  .post(engTumble.createTumbleModel);
app.route('/api/tumble/model/:id')
  .put(engTumble.updateTumbleModel)
  .delete(engTumble.deleteTumbleModel);

// Tumble Condition
app.route('/api/tumble/condition/search').get(engTumble.getTumbleConditionByCode);
app.route('/api/tumble/condition')
  .get(engTumble.getAllTumbleCondition)
  .post(engTumble.createTumbleCondition);
app.route('/api/tumble/condition/:id')
  .put(engTumble.updateTumbleCondition)
  .delete(engTumble.deleteTumbleCondition);

// Tumble Condition Part
app.route('/api/tumble/condition-part')
  .get(engTumble.getAllTumbleConditionPart)
  .post(engTumble.createTumbleConditionPart);
app.route('/api/tumble/condition-part/:id')
  .put(engTumble.updateTumbleConditionPart)
  .delete(engTumble.deleteTumbleConditionPart);

// MRP Data
app.route('/api/tumble/mrp/:lotNo').get(engTumble.getMrpDataByLotNo);

// Legacy Compatibility (if needed)
app.route('/api/tumble/getAllCondition').get(engTumble.getAllTumbleCondition);
app.route('/api/tumble/getAllModel').get(engTumble.getAllTumbleModel);


// File Upload API
app.post('/api/upload', (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ success: false, message: 'No files were uploaded.' });
  }

  const uploadedFile = req.files.file;
  // Generate unique name
  const ext = path.extname(uploadedFile.name);
  const filename = `upload_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
  const uploadPath = path.join(__dirname, 'files', 'uploads', filename);

  uploadedFile.mv(uploadPath, function (err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    // Return relative path accessible via static serving
    res.json({ success: true, file_url: `/uploads/${filename}`, file_name: uploadedFile.name });
  });
});

//------------------MTC Engineer (Refactored)------------------//
const mtcRoutes = require('./api/engineer/mtc/routes/mtcRoutes');
app.use('/api/engineer/mtc', mtcRoutes);

const toolingSelectController = require('./api/engineer/mtc/controllers/toolingSelectController');
app.use('/api/tooling-select', verifyToken, toolingSelectController);

const { isAdmin: mtcIsAdmin } = require('./middleware/mtcAuth');
const toolingFormulaController = require('./api/engineer/mtc/controllers/toolingFormulaController');
app.post('/api/mtc/tooling-formula/test', verifyToken, toolingFormulaController.test);
app.get('/api/mtc/tooling-formula/machines', verifyToken, toolingFormulaController.getMachines);
app.get('/api/mtc/tooling-formula/:machineName', verifyToken, toolingFormulaController.getFormulas);
app.post('/api/mtc/tooling-formula', verifyToken, mtcIsAdmin, toolingFormulaController.create);
app.put('/api/mtc/tooling-formula/:id', verifyToken, mtcIsAdmin, toolingFormulaController.update);
app.delete('/api/mtc/tooling-formula/:id', verifyToken, mtcIsAdmin, toolingFormulaController.remove);

const sdsV2Controller = require('./api/engineer/mtc/controllers/sdsV2Controller');
app.use('/api/sds/v2', sdsV2Controller);

const sdsV2ImageController = require('./api/engineer/mtc/controllers/sdsV2ImageController');
app.use('/api/sds/v2/images', sdsV2ImageController);

const sdsV2AdminController = require('./api/engineer/mtc/controllers/sdsV2AdminController');
app.use('/api/sds/v2/admin', sdsV2AdminController);

const sdsV2PdfController = require('./api/engineer/mtc/controllers/sdsV2PdfController');
app.use('/api/sds/v2', sdsV2PdfController);

// Backward Compatibility for Tooling Inspect
const legacyMtcController = require('./api/engineer/mtc/controllers/legacyMtcController');
app.route('/api/tooling_inspect/getlist').get(verifyToken, legacyMtcController.ToolingInspectGetlist);
app.route('/api/tooling_inspect/dashboard_stats').get(verifyToken, legacyMtcController.ToolingDashboadtGetlist);
app.route('/api/tooling_inspect/dwg_require_getlist').get(verifyToken, legacyMtcController.ToolDWGRequestGetList);

// Protected Modification endpoints
app.route('/api/tooling_inspect/dwg_require_add').post(verifyToken, legacyMtcController.ToolDWGRequestAdd);
app.route('/api/tooling_inspect/dwg_require_update').put(verifyToken, legacyMtcController.ToolDWGRequestUpdate);
app.route('/api/tooling_inspect/return_add').post(verifyToken, legacyMtcController.ToolingReturnAdd);
app.route('/api/tooling_inspect/inspect_update').post(verifyToken, legacyMtcController.ToolingInspectUpdate);
app.route('/api/tooling_inspect/sync_csv').post(verifyToken, legacyMtcController.ToolingSyncCSV);
app.route('/api/master/wc').get(verifyToken, legacyMtcController.GetWCCodes);


// ============================================================================
// Tool Request System (General DWG Request)
// ============================================================================
const toolReq = require('./api/engineer/mtc/controllers/toolRequestController');

// Import middleware for enhanced security
const { verifyToken: mtcVerifyToken, optionalAuth } = require('./api/engineer/mtc/utils/toolRequestAuth');
const { validateFileUpload } = require('./api/engineer/mtc/utils/fileUpload');

// Public endpoints (no authentication required - viewing only)
app.get('/api/engineer/mtc/tool-requests', toolReq.getToolRequests);
app.get('/api/engineer/mtc/tool-requests/dashboard', toolReq.getToolRequestDashboard);
app.get('/api/engineer/mtc/tool-requests/permissions', toolReq.getStagePermissions);
app.get('/api/engineer/mtc/tool-requests/:id', toolReq.getToolRequestById);

// Protected endpoints (require authentication)
app.post('/api/engineer/mtc/tool-requests/test-email', mtcVerifyToken, toolReq.testEmail);

app.post('/api/engineer/mtc/tool-requests',
  mtcVerifyToken,
  validateFileUpload({ fieldName: 'attachment', required: false }),
  toolReq.createToolRequest
);

app.post('/api/engineer/mtc/tool-requests/:id/action',
  mtcVerifyToken,
  toolReq.submitAction
);

app.put('/api/engineer/mtc/tool-requests/:id',
  mtcVerifyToken,
  toolReq.updateToolRequest
);

app.delete('/api/engineer/mtc/tool-requests/:id',
  mtcVerifyToken,
  toolReq.deleteToolRequest
);

// Email Configuration Management (Admin only - verified by token)
app.get('/api/engineer/mtc/email-config', mtcVerifyToken, toolReq.getEmailConfigs);
app.post('/api/engineer/mtc/email-config', mtcVerifyToken, toolReq.createEmailConfig);
app.put('/api/engineer/mtc/email-config/:id', mtcVerifyToken, toolReq.updateEmailConfig);
app.delete('/api/engineer/mtc/email-config/:id', mtcVerifyToken, toolReq.deleteEmailConfig);

// Note: For production deployment, enable authentication by:
// 1. Uncomment the middleware imports above
// 2. Add verifyToken middleware to protected endpoints
// 3. Set JWT_SECRET in .env file
// 4. See API_DOCUMENTATION.md for authentication details




//--------------------Kanban Board Module (/api/kanban)---------------------//
const kanbanRoutes = require('./api/kanban/kanbanRoutes');

// Middleware: preserve JWT user identity for Kanban, map empno → id
app.use('/api/kanban', (req, res, next) => {
  // console.log(req.user);
  if (req.user && req.user.empno) {
    req.user.id = req.user.empno;
  }
  next();
});

app.use('/api/kanban', kanbanRoutes);

//--------------------FEA Simulation Module---------------------//
const feaSimulation = require('./api/fea/fea_router');
// Also initialize worker so it starts listening
require('./api/fea/fea_worker');
app.use('/api/fea', feaSimulation);
// Expose the output directory so the frontend can fetch the generated JSON files
app.use('/output', express.static(path.join(__dirname, 'output')));

// const { HttpsProxyAgent } = require('https-proxy-agent');
// const proxyUrl = 'http://lble131:Eng1234567889@proxyth.bp.minebea.local:8080';
// const proxyAgent = new HttpsProxyAgent(proxyUrl);

// const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// google.options({
//     auth: oAuth2Client,
//     agent: proxyAgent
// });

const gmailCtrl = require('./api/system/gmail_controller');

app.route('/api/send-email').post(gmailCtrl.handleSendEmail);
app.route('/api/gmail-status').get(gmailCtrl.getGmailStatus);

//--------------------User Management (System Engineer)---------------------//
const userManagement = require('./api/user/userManagementModel');

// Role Authorization Middleware for Schema Changes
const requireSuperAdminOrEmergency = (req, res, next) => {
  console.log(req.user);
  // Determine user role from request (u_role or u_authority or userDepartment)
  const role = req.user?.role || req.user?.u_role || req.user?.department || 'ENG';
  const auth = req.user?.auth || req.user?.u_authority;
  // According to system knowledge, AD=Super Admin, Emergency User might be specific
  if (role === 'AD' || auth === 'Emergency User' || auth === 'Super Admin') {
    next();
  } else {
    return res.status(403).json({ result: 'false', message: 'Unauthorized schema alteration permission.' });
  }
};

app.get('/api/system/user-management/schema', userManagement.getSchema);
app.get('/api/system/user-management/users', userManagement.getUsers);
app.post('/api/system/user-management/users', userManagement.createUser);
app.put('/api/system/user-management/users/:u_code', userManagement.updateUser);
app.delete('/api/system/user-management/users/:u_code', userManagement.deleteUserRecord);

// Schema Modifying endpoints requiring super admin access
app.post('/api/system/user-management/schema/add-column', requireSuperAdminOrEmergency, userManagement.addColumn);
app.post('/api/system/user-management/schema/drop-column', requireSuperAdminOrEmergency, userManagement.dropColumn);

// System Settings
const requireSystemEngineer = (req, res, next) => {
  const dept = req.user?.department || req.user?.u_department;
  const role = req.user?.role || req.user?.u_role;
  if (dept === 'AD' || role === 'AD') {
    next();
  } else {
    return res.status(403).json({ result: 'false', message: 'Unauthorized setting permission. System Engineer only.' });
  }
};

const settingsModel = require('./api/system/settingsModel');
app.get('/api/system/settings', settingsModel.getSettings);
app.post('/api/system/settings', requireSystemEngineer, settingsModel.updateSettings);

