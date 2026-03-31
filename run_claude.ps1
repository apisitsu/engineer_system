# 1. ตั้งค่า Path ของ Bash
$env:CLAUDE_CODE_GIT_BASH_PATH = "$env:LocalAppData\Programs\Git\bin\bash.exe"

# 2. ตั้งค่า Proxy แบบใส่รหัสผ่าน (สำคัญมาก!)
# เปลี่ยน 'รหัสพนักงาน' และ 'รหัสผ่าน' เป็นของคุณจริงๆ
$user = "lble485"
$pass = "Kpx89164%234"  # เปลี่ยน # เป็น %23
$proxy_url = "http://$($user):$($pass)@proxyth.bp.minebea.local:8080"

$env:HTTP_PROXY  = $proxy_url
$env:HTTPS_PROXY = $proxy_url
$env:http_proxy  = $proxy_url
$env:https_proxy = $proxy_url

# 3. ข้ามการตรวจ SSL (สำหรับ Proxy Skyhigh)
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"

# 4. บังคับ Node.js ให้ใช้การเชื่อมต่อแบบยืดหยุ่น
$env:NODE_OPTIONS = "--tls-cipher-list=DEFAULT@SECLEVEL=1"

# 5. เริ่มรัน Claude
claude