$env:CLAUDE_CODE_GIT_BASH_PATH = "$env:LocalAppData\Programs\Git\bin\bash.exe"

$user = "lble485"
$pass = "Kpx89164%234" 
$proxy_url = "http://$($user):$($pass)@proxyth.bp.minebea.local:8080"

$env:HTTP_PROXY = $proxy_url
$env:HTTPS_PROXY = $proxy_url
$env:http_proxy = $proxy_url
$env:https_proxy = $proxy_url

$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:NODE_OPTIONS = "--tls-cipher-list=DEFAULT@SECLEVEL=1"

$env:HTTPS_PROXY_AGENT_HTTP_PROXY = $proxy_url

claude