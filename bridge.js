const http = require('http');
const os = require('os');
const { execSync } = require('child_process');

const ALLOW = [
  'check-wallet',
  'submit-payment',
  'query-payment-status',
  'apply-wallet',
  'bind-wallet'
];

// 安全校验：submit-payment 的 URL 必须是支付宝收银台域名
function validateArg(sub, arg) {
  if (sub === 'submit-payment') {
    const match = arg.match(/https:\/\/cashier[\w]*\.alipay\.com\/[^\s"']*/);
    if (!match) return false;
  }
  // 拦截常见注入字符（URL 本身除外）
  if (/[;&|`$(){}]/.test(arg.replace(/https?:\/\/[^\s"']*/g, ''))) return false;
  return true;
}

// 自己找出这台电脑现在的局域网地址（换 Wi-Fi 也不用改文件）
function localIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

http.createServer((q, r) => {
  const u = new URL(q.url, 'http://localhost');
  const sub = u.searchParams.get('sub');
  const arg = u.searchParams.get('arg') || '';
  if (!ALLOW.includes(sub)) { r.end('blocked: unknown command'); return; }
  if (!validateArg(sub, arg)) { r.end('blocked: invalid argument'); return; }
  try {
    // 修复：URL 必须用引号包起来，否则里面的 & 会被 shell 当成指令分隔符，参数被截断
    const o = execSync(
      'alipay-bot ' + sub + ' "' + arg.replace(/"/g, '') + '"',
      { encoding: 'utf-8', timeout: 30000 }
    );
    r.end(o);
  } catch (e) {
    r.end(e.stderr || e.message);
  }
}).listen(8933, () => {
  console.log('alipay bridge on :8933');
  console.log('this computer is at: http://' + localIP() + ':8933/');
});