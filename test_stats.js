const fs = require('fs');
const vm = require('vm');
let code = fs.readFileSync('/workspace/stats.js', 'utf8');
// 将 const Stats = (function... 改为 var Stats = ...使其在上下文中可见
code = code.replace('const Stats =', 'var Stats =');
const ctx = { console: console, Math: Math };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const Stats = ctx.Stats;
