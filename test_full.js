const fs = require('fs');
const vm = require('vm');
let code = fs.readFileSync('/workspace/stats.js', 'utf8');
code = code.replace('const Stats =', 'var Stats =');
const ctx = { console: console, Math: Math };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const Stats = ctx.Stats;

function seedRand(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seedRand(42);

console.log('=== 统计库功能测试 ===\n');

// 1. 基础统计
const data = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 10.1];
console.log('1. 基础统计: 均值=' + Stats.mean(data).toFixed(3) + ', 标准差=' + Stats.stddev(data).toFixed(3));

// 2. ACF / PACF
const acf = Stats.acf(data, 5);
const pacf = Stats.pacf(data, 5);
console.log('2. ACF[0..3]: ' + acf.slice(0, 4).map(function(v){return v.toFixed(3);}).join(', '));
console.log('   PACF[0..3]: ' + pacf.slice(0, 4).map(function(v){return v.toFixed(3);}).join(', '));

// 3. 差分
console.log('3. 差分后长度=' + Stats.diff(data, 1).length);

// 4. ADF
let y = [0];
for (let i = 1; i < 100; i++) y.push(0.8 * y[i-1] + (rand() - 0.5) * 2);
let y2 = [0];
for (let i = 1; i < 100; i++) y2.push(y2[i-1] + (rand() - 0.5) * 2);
console.log('4. 平稳 ADF p=' + Stats.adfTest(y, 5).pValue.toFixed(3));
console.log('   非平稳 ADF p=' + Stats.adfTest(y2, 5).pValue.toFixed(3));

// 5. ARIMA
const fit = Stats.fitARIMA(y, 2, 1);
console.log('5. ARIMA(2,0,1): success=' + fit.success + ', AR=[' + fit.arCoefs.map(function(v){return v.toFixed(3);}).join(',') + '], MA=[' + fit.maCoefs.map(function(v){return v.toFixed(3);}).join(',') + ']');
console.log('   AIC=' + Stats.aic(fit.residuals, 3).toFixed(2) + ', BIC=' + Stats.bic(fit.residuals, 3).toFixed(2));
console.log('   AR平稳=' + fit.arStationary + ', MA可逆=' + fit.maInvertible);

// 6. Ljung-Box
console.log('6. 残差LB p=' + Stats.ljungBoxTest(fit.residuals, 20).pValue.toFixed(3));
console.log('   原序列LB p=' + Stats.ljungBoxTest(y, 20).pValue.toFixed(3));

// 7. 预测
console.log('7. 5步预测: [' + Stats.forecastARIMA(fit, y, 5, y.slice(-10), 0).map(function(v){return v.toFixed(3);}).join(',') + ']');

// 8. 季节性
const sd = [];
for (let i = 0; i < 120; i++) sd.push(10 * Math.sin(2 * Math.PI * i / 12) + (rand() - 0.5) + i * 0.1);
console.log('8. 带周期序列 seasonality=' + Stats.detectSeasonality(sd).hasSeasonality + ', period=' + Stats.detectSeasonality(sd).period);
console.log('   无周期序列 seasonality=' + Stats.detectSeasonality(y).hasSeasonality);

// 9. 缺失值
console.log('9. 缺失值: count=' + Stats.checkMissing([1, 2, NaN, 4, '', 6]).count);

// 10. 网格
console.log('10. 网格搜索:');
let best = { p: 0, q: 0, aic: Infinity };
for (let p = 0; p <= 3; p++) {
  for (let q = 0; q <= 2; q++) {
    try {
      const f = Stats.fitARIMA(y, p, q);
      if (f && f.success) {
        const a = Stats.aic(f.residuals, p + q);
        if (a < best.aic) best = { p: p, q: q, aic: a };
        console.log('   (' + p + ',' + q + '): AIC=' + a.toFixed(2));
      }
    } catch(e) {}
  }
}
console.log('   最优: (' + best.p + ',' + best.q + ') AIC=' + best.aic.toFixed(2));

console.log('\n=== 所有测试完成 ✓ ===');
