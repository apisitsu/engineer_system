# 1. Path ไปยัง Git Bash
$env:CLAUDE_CODE_GIT_BASH_PATH = "$env:LocalAppData\Programs\Git\bin\bash.exe"

# 2. ตั้งค่า Proxy (Encode ตัว # เป็น %23 เรียบร้อย)
$user = "lble485"
$pass = "Kpx89164%235" 
$proxy_url = "http://$($user):$($pass)@proxyth.bp.minebea.local:8080"

$env:HTTP_PROXY  = $proxy_url
$env:HTTPS_PROXY = $proxy_url
$env:http_proxy  = $proxy_url
$env:https_proxy = $proxy_url

# 3. ข้ามการตรวจ SSL และตั้งค่าความปลอดภัยให้ยืดหยุ่น
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:NODE_OPTIONS = "--tls-cipher-list=DEFAULT@SECLEVEL=1"

# 4. ล้างค่า Proxy เก่าที่ไม่มีรหัสผ่าน (กันเหนียว)
$env:HTTPS_PROXY_AGENT_HTTP_PROXY = $proxy_url

# 5. ตั้งค่า Git Proxy (เขียน ~/.gitconfig ถาวร)
git config --global http.proxy $proxy_url
git config --global https.proxy $proxy_url

claude