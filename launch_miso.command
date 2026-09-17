#!/bin/zsh
set -e
cd "$(dirname "$0")/web"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  printf '需要先安装 Node.js 20.19 或更新版本：https://nodejs.org/\n'
  read 'reply?按回车关闭'; exit 1
fi
if curl --silent --fail http://localhost:5179/ | /usr/bin/grep -q 'Miso'; then
  open http://localhost:5179/
  exit 0
fi
if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi
npm run dev &
miso_server_pid=$!
trap 'kill "$miso_server_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in {1..40}; do
  if curl --silent --fail http://localhost:5179/ >/dev/null; then
    open http://localhost:5179/
    break
  fi
  sleep .25
done
printf '\nMiso 已启动。关闭此窗口会停止本地服务。\n'
wait "$miso_server_pid"
