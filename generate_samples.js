// 示例 Excel 文件生成脚本
// 生成多种时序数据用于调试 ARIMA 分析工具

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'sample_data');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 简单的种子随机数生成器
function seedRand(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function writeExcel(filename, rows, header) {
  const data = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const fullPath = path.join(OUTPUT_DIR, filename);
  XLSX.writeFile(wb, fullPath);
  console.log(`✓ 已生成: ${filename} (${rows.length} 行数据)`);
}

// ============================================================
// 示例 1: 平稳 AR(2) 序列（适合 ARMA 模型，d=0）
// y_t = 0.8 * y_{t-1} - 0.3 * y_{t-2} + ε_t
// ============================================================
function generateStationaryAR2() {
  const rand = seedRand(101);
  const n = 120;
  const y = [0, 0];
  for (let i = 2; i < n; i++) {
    const noise = (rand() - 0.5) * 2;
    y.push(0.8 * y[i - 1] - 0.3 * y[i - 2] + noise);
  }
  const rows = y.map((v, i) => [`2020-${String((i % 12) + 1).padStart(2, '0')}`, v.toFixed(4)]);
  writeExcel('01_stationary_AR2.xlsx', rows, ['月份', '观测值']);
}

// ============================================================
// 示例 2: 非平稳序列（带线性趋势，需要差分）
// y_t = 0.1 * t + AR(1) 噪声
// ============================================================
function generateTrendSeries() {
  const rand = seedRand(202);
  const n = 150;
  const y = [];
  for (let i = 0; i < n; i++) {
    const trend = 0.15 * i;
    const noise = i === 0 ? 0 : 0.6 * (y[i - 1] - 0.15 * (i - 1)) + (rand() - 0.5) * 1.5;
    y.push(trend + noise + 10);
  }
  const rows = y.map((v, i) => [i + 1, v.toFixed(4)]);
  writeExcel('02_nonstationary_trend.xlsx', rows, ['期数', '观测值']);
}

// ============================================================
// 示例 3: 带强季节性的序列（应触发 SARIMA 提示）
// y_t = 10 * sin(2πt/12) + 0.05*t + 噪声
// ============================================================
function generateSeasonalSeries() {
  const rand = seedRand(303);
  const n = 144; // 12 年 × 12 月
  const y = [];
  for (let i = 0; i < n; i++) {
    const seasonal = 10 * Math.sin((2 * Math.PI * i) / 12);
    const trend = 0.05 * i;
    const noise = (rand() - 0.5) * 2;
    y.push(seasonal + trend + noise + 20);
  }
  const rows = y.map((v, i) => [`2010-${String((i % 12) + 1).padStart(2, '0')}`, v.toFixed(4)]);
  writeExcel('03_seasonal_12period.xlsx', rows, ['月份', '销售额']);
}

// ============================================================
// 示例 4: 含缺失值的序列（应触发数据校验失败）
// ============================================================
function generateWithMissing() {
  const rand = seedRand(404);
  const n = 100;
  const y = [0];
  for (let i = 1; i < n; i++) {
    y.push(0.7 * y[i - 1] + (rand() - 0.5) * 2);
  }
  const rows = y.map((v, i) => {
    // 在几个位置插入缺失值
    if (i === 25 || i === 50 || i === 75) {
      return [i + 1, ''];
    }
    return [i + 1, v.toFixed(4)];
  });
  writeExcel('04_with_missing_values.xlsx', rows, ['期数', '观测值']);
}

// ============================================================
// 示例 5: 含异常值的序列（3σ 法则应能检测）
// ============================================================
function generateWithOutliers() {
  const rand = seedRand(505);
  const n = 120;
  const y = [0];
  for (let i = 1; i < n; i++) {
    y.push(0.75 * y[i - 1] + (rand() - 0.5) * 1.5);
  }
  // 注入 3 个显著异常值
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  y[30] = mean + 15;
  y[60] = mean - 12;
  y[90] = mean + 10;
  const rows = y.map((v, i) => [i + 1, v.toFixed(4)]);
  writeExcel('05_with_outliers.xlsx', rows, ['期数', '观测值']);
}

// ============================================================
// 示例 6: 白噪声（接近随机，无法建模，应在 ACF/PACF 步骤终止）
// ============================================================
function generateWhiteNoise() {
  const rand = seedRand(606);
  const n = 100;
  const y = [];
  for (let i = 0; i < n; i++) {
    y.push((rand() - 0.5) * 4);
  }
  const rows = y.map((v, i) => [i + 1, v.toFixed(4)]);
  writeExcel('06_white_noise.xlsx', rows, ['期数', '随机数']);
}

// ============================================================
// 示例 7: MA(1) 过程（适合测试 MA 模型识别）
// y_t = ε_t + 0.6 * ε_{t-1}
// ============================================================
function generateMA1() {
  const rand = seedRand(707);
  const n = 120;
  let prevErr = 0;
  const y = [];
  for (let i = 0; i < n; i++) {
    const err = (rand() - 0.5) * 2;
    y.push(err + 0.6 * prevErr + 5);
    prevErr = err;
  }
  const rows = y.map((v, i) => [i + 1, v.toFixed(4)]);
  writeExcel('07_MA1_process.xlsx', rows, ['期数', '观测值']);
}

// ============================================================
// 示例 8: ARMA(1,1) 过程（混合模型）
// y_t = 0.7*y_{t-1} + ε_t + 0.4*ε_{t-1}
// ============================================================
function generateARMA11() {
  const rand = seedRand(808);
  const n = 150;
  let prevErr = 0;
  const y = [0];
  for (let i = 1; i < n; i++) {
    const err = (rand() - 0.5) * 1.5;
    y.push(0.7 * y[i - 1] + err + 0.4 * prevErr);
    prevErr = err;
  }
  const rows = y.map((v, i) => [i + 1, v.toFixed(4)]);
  writeExcel('08_ARMA_1_1.xlsx', rows, ['期数', '观测值']);
}

// ============================================================
// 示例 9: 小样本（不足最小样本量，测试终止条件）
// ============================================================
function generateSmallSample() {
  const rand = seedRand(909);
  const n = 15; // 小于默认 30 的最小样本量
  const y = [0];
  for (let i = 1; i < n; i++) {
    y.push(0.7 * y[i - 1] + (rand() - 0.5) * 1.5);
  }
  const rows = y.map((v, i) => [i + 1, v.toFixed(4)]);
  writeExcel('09_small_sample.xlsx', rows, ['期数', '观测值']);
}

// ============================================================
// 示例 10: 多列数据（测试列选择功能）
// ============================================================
function generateMultiColumn() {
  const rand = seedRand(1010);
  const n = 100;
  const rows = [];
  const y1 = [0];
  const y2 = [0];
  for (let i = 1; i < n; i++) {
    y1.push(0.8 * y1[i - 1] + (rand() - 0.5) * 1.5);
    y2.push(0.5 * y2[i - 1] + (rand() - 0.5) * 2);
  }
  for (let i = 0; i < n; i++) {
    rows.push([
      i + 1,
      `2023-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      y1[i].toFixed(4),
      y2[i].toFixed(4),
      (y1[i] + y2[i] + rand()).toFixed(4)
    ]);
  }
  writeExcel('10_multi_column.xlsx', rows, ['序号', '日期', '指标A', '指标B', '指标C']);
}

// ============================================================
// 主函数
// ============================================================
function main() {
  console.log('正在生成示例 Excel 文件...');
  console.log('输出目录: ' + OUTPUT_DIR);
  console.log('');

  try {
    generateStationaryAR2();      // 01
    generateTrendSeries();         // 02
    generateSeasonalSeries();      // 03
    generateWithMissing();         // 04
    generateWithOutliers();        // 05
    generateWhiteNoise();          // 06
    generateMA1();                 // 07
    generateARMA11();              // 08
    generateSmallSample();         // 09
    generateMultiColumn();         // 10

    console.log('');
    console.log('✓ 全部完成！共生成 10 个示例文件');
    console.log('');
    console.log('各文件用途:');
    console.log('  01 - 平稳 AR(2): 测试 ARMA 建模（d=0）');
    console.log('  02 - 带趋势非平稳: 测试差分阶数 d>0 的 ARIMA');
    console.log('  03 - 强季节性: 应触发 SARIMA 提示');
    console.log('  04 - 含缺失值: 测试数据校验缺失值检测');
    console.log('  05 - 含异常值: 测试 3σ 异常值检测');
    console.log('  06 - 白噪声: 应在 ACF/PACF 步骤无法建模');
    console.log('  07 - MA(1): 测试 MA 模型识别');
    console.log('  08 - ARMA(1,1): 测试混合模型');
    console.log('  09 - 小样本: 测试最小样本量终止');
    console.log('  10 - 多列: 测试列选择功能');
  } catch (err) {
    console.error('生成失败:', err.message);
    process.exit(1);
  }
}

main();
