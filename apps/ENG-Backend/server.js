//--------------------Import & Config Backend--------------------//
// require('dotenv').config();
const express = require("express");
const http = require("http");
const path = require("path");
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
app.use(fileupload({ createParentPath: true, limits: { fileSize: 50 * 1024 * 1024 } }));
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
  if (req.path === '/login-user' || req.path === '/refresh-token' || req.path === '/sds/test-puppeteer' || req.path.startsWith('/public')) {
    return next();
  }

  return verifyToken(req, res, next);
});

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

app.route('/api/ecr/getlist').get(engProcess.ecrGetList)
app.route('/api/ecr/create').post(engProcess.ecrCreate)
app.route('/api/tumble/getAllCondition').get(engProcess.tumbleGetAllCondition)
app.route('/api/tumble/createCondition').post(engProcess.tumbleCreateCondition)
app.route('/api/tumble/updateCondition/:id').put(engProcess.tumbleUpdateCondition)
app.route('/api/tumble/deleteCondition/:id').delete(engProcess.tumbleDeleteCondition)
app.route('/api/tumble/getAllModel').get(engProcess.tumbleGetAllModel)
app.route('/api/tumble/createModel').post(engProcess.tumbleCreateModel)
app.route('/api/tumble/updateModel/:id').put(engProcess.tumbleUpdateModel)
app.route('/api/tumble/deleteModel/:id').delete(engProcess.tumbleDeleteModel)

//------------------ MTC Routes ----------------//
const engMTC = require('./api/engineer/mtc/eng_mtc_model');
const toolingSelect = require('./api/engineer/mtc/tooling_select');
const sds = require('./api/engineer/mtc/sds');

app.route('/api/tooling_inspect/getlist').get(engMTC.ToolingInspectGetlist)
app.route('/api/tooling_inspect/dwg_require_getlist').get(engMTC.ToolDWGRequestGetList)
app.route('/api/tooling_inspect/dwg_require_add').post(engMTC.ToolDWGRequestAdd)
app.route('/api/tooling_inspect/dashboard_stats').get(engMTC.ToolingDashboadtGetlist)
app.route('/api/tooling_inspect/return_add').post(engMTC.ToolingReturnAdd)
app.route('/api/tooling_inspect/inspect_update').post(engMTC.ToolingInspectUpdate)
app.route('/api/master/wc').get(engMTC.GetWCCodes)

app.use('/api/tooling-select', toolingSelect);
app.use('/api/sds', sds);


// Tool Request System
const toolReq = require('./api/engineer/mtc/tool_req');

app.get('/api/engineer/mtc/tool-requests', toolReq.getToolRequests);
app.get('/api/engineer/mtc/tool-requests/dashboard', toolReq.getToolRequestDashboard);
app.get('/api/engineer/mtc/tool-requests/permissions', toolReq.getStagePermissions);
app.get('/api/engineer/mtc/tool-requests/:id', toolReq.getToolRequestById);
app.post('/api/engineer/mtc/tool-requests', toolReq.createToolRequest);
app.post('/api/engineer/mtc/tool-requests/:id/action', toolReq.submitAction);
app.put('/api/engineer/mtc/tool-requests/:id', toolReq.updateToolRequest);
app.delete('/api/engineer/mtc/tool-requests/:id', toolReq.deleteToolRequest);


//--------------------System Engineer (TODO/Project Management v2)---------------------//
const system = require('./api/engineer/system/todoModel_v2');
const { resolveEffectiveUser } = require('./api/engineer/system/rbacMiddleware');

// Middleware to attach user info + admin simulation support
app.use('/api/system', (req, res, next) => {
  // Parse user from body or headers if present, otherwise keep decoded JWT user
  let specifiedUser = null;
  if (req.body && req.body.user) {
    specifiedUser = req.body.user;
  } else if (req.headers && req.headers.user) {
    try {
      specifiedUser = JSON.parse(req.headers.user);
    } catch (e) {
      specifiedUser = null;
    }
  }

  // Only override if explicitly provided
  if (specifiedUser) {
    req.user = { ...req.user, ...specifiedUser };
  } else if (!req.user) {
    req.user = {};
  }

  // Apply admin simulation if x-simulate-user header is present
  req.user = resolveEffectiveUser(req);

  try {
    req.db = require('./instance/todo_v2')?.db; // Attach database safely
  } catch (e) {
    // Ignore if todo_v2 doesn't exist yet
  }
  next();
});

// Projects
app.get('/api/system/get_project', system.GetProjects);
app.get('/api/system/get_project/:id', system.GetProjectById);
app.post('/api/system/create_project', system.CreateProject);
app.put('/api/system/update_project/:id', system.UpdateProject);
app.delete('/api/system/delete_project/:id', system.DeleteProject);
app.put('/api/system/close_project/:id', system.CloseProject);
app.get('/api/system/get_project_stats/:id', system.GetProjectStats);
app.get('/api/system/get_dashboard_data', system.GetDashboardData);
app.get('/api/system/get_dashboard_detail', system.GetDashboardDetailData);

// Project Members
app.get('/api/system/get_project_members/:id', system.GetProjectMembers);
app.post('/api/system/add_project_member/:id', system.AddProjectMember);
app.delete('/api/system/remove_project_member/:id', system.RemoveProjectMember);

// Tasks (updated endpoint names for consistency)
app.get('/api/system/get_todolist/:id', system.GetTasksByProject);
app.get('/api/system/get_tasks/:id', system.GetTasksByProject); // Alias
app.post('/api/system/create_todolist', system.CreateTask);
app.post('/api/system/create_task', system.CreateTask); // Alias
app.put('/api/system/update_todolist/:id', system.UpdateTask);
app.put('/api/system/update_task/:id', system.UpdateTask); // Alias
app.delete('/api/system/delete_todolist/:id', system.DeleteTask);
app.delete('/api/system/delete_task/:id', system.DeleteTask); // Alias
app.put('/api/system/reorder_todolist', system.ReorderTasks);
app.put('/api/system/reorder_tasks', system.ReorderTasks); // Alias

// Templates
app.get('/api/system/get_templates', system.GetTemplates);
app.get('/api/system/get_template_items/:id', system.GetTemplateItems);
app.post('/api/system/create_template', system.CreateTemplate);
app.post('/api/system/apply_template', system.ApplyTemplate);


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

