const { pool } = require("../../instance/instance");
const constance = require("../../constance/constance");
const userModel = require('./userModel');
exports.handleUserEvent = async (req, res) => {
  const { eventId, empno, password, empname, auth, role } = req.body || {};  // ตรวจสอบข้อมูลจาก body

  if (!eventId || !empno || (eventId !== 'delete' && (!password || !empname || !auth))) {
    return res.status(400).json({ error: 'Missing required fields' });  // ตรวจสอบการใช้ res
  }

  try {
    let result;
    switch (eventId) {
      case 'login':
        result = await userModel.authenticate(empno, password);
        break;
      case 'regist':
        result = await userModel.register(empno, empname, password, auth);
        break;
      case 'update':
        result = await userModel.updateUser(empno, empname, password, auth);
        break;
      case 'delete':
        result = await userModel.deleteUser(empno);
        break;
      default:
        return res.status(400).json({ error: 'Invalid eventId' });  // ตรวจสอบการใช้ res
    }

    res.json(result);  // ส่งข้อมูลกลับไป
  } catch (err) {
    console.error("Error in handleUserEvent:", err);
    res.status(500).json({ error: 'Server error during user event handling' });
  }
};
