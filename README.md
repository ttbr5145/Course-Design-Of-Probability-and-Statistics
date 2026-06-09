# ARIMA 时间序列分析 Web 工具

一款纯前端运行的交互式时间序列分析工具，支持 ARIMA / ARMA / SARIMA 模型的自动识别、拟合、检验与预测。所有计算在浏览器本地完成，数据无需上传服务器。

![Tech Stack](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

---

## ✨ 功能特性

- 📊 **数据导入** — 支持 `.xlsx` / `.xls` 格式 Excel 文件上传，自动识别数值列与时间列
- 🔍 **自动分析流程** — 8 步全流程自动化分析，每步输出详细结果与图表
  1. **数据校验** — 缺失值检测、异常值识别（3σ 法则）、样本量检查
  2. **季节性初判** — 周期扫描，触发 SARIMA 建议
  3. **平稳性检验** — ADF 单位根检验 + 自动差分（d 阶识别）
  4. **ACF / PACF 分析** — 自相关 / 偏自相关函数估计与显著性判断
  5. **p / q 阶数寻优** — AIC / BIC 信息准则网格搜索最优阶数
  6. **模型拟合** — 极大似然估计 AR / MA 系数，返回参数标准误与 p 值
  7. **残差白噪声检验** — Ljung-Box Q 检验验证残差无自相关
  8. **预测效果评估** — 训练/测试集划分，MAE / MSE / RMSE / MAPE 指标 + 过拟合诊断
- 📈 **可视化** — 基于 Chart.js 绘制原始序列、ACF/PACF、拟合对比、预测曲线等
- 🔮 **未来预测** — 输出未来 12 期预测值表
- 📋 **模型摘要** — 完整报告：模型类型、阶数、AIC/BIC、残差方差、平稳性/可逆性判断
- 🛠 **参数可调** — 显著性水平 α、差分阶数上限 d_max、p/q 阶数上下限、最小样本量、测试集比例

---

## 🧱 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 前端 | HTML5 + CSS3 | 页面结构与样式 |
| 核心 | 原生 JavaScript (ES6+) | 所有时序算法实现 |
| Excel 解析 | [SheetJS / xlsx@0.18.5](https://sheetjs.com/) | Excel 文件读写 |
| 图表 | [Chart.js 4.4](https://www.chartjs.org/) | 序列与 ACF/PACF 可视化 |
| 运行 | 浏览器 | 纯前端，无需后端服务 |

> 所有依赖通过 CDN 加载，打开 `index.html` 即可使用。

---

## 🚀 快速开始

### 方式一：直接打开

```bash
# 克隆仓库
git clone https://github.com/ttbr5145/ARIMA_Time_Series_Analysis_Web_Tool.git
cd ARIMA_Time_Series_Analysis_Web_Tool

# 在浏览器中打开
open index.html   # macOS
# 或 Windows: start index.html
# 或 Linux: xdg-open index.html
```

### 方式二：本地 HTTP 服务（推荐）

```bash
# Python 3
python3 -m http.server 8080
# 然后访问 http://localhost:8080

# Node.js
npx serve .
```

### 方式三：使用示例数据测试

仓库提供 10 个预置样本文件（`sample_data/*.xlsx`），涵盖典型场景：

```bash
node generate_samples.js   # 重新生成样本数据（可选，依赖 npm install）
```

直接在页面上传 `sample_data/01_stationary_AR2.xlsx` 即可开始分析。

---

## 📁 项目结构

```
.
├── index.html              # 页面入口（布局 & 流程容器）
├── styles.css              # 全部样式（含动画 & 响应式布局）
├── stats.js                # 统计工具库（ADF、ACF/PACF、MLE、Ljung-Box 等）
├── app.js                  # 主应用逻辑（8 步流程驱动 & 图表渲染）
├── generate_samples.js     # 示例数据生成脚本（Node.js + xlsx）
├── test_stats.js           # stats.js 单元测试
├── test_full.js            # 完整流程端到端测试
├── package.json            # npm 依赖声明（仅用于样本生成）
├── package-lock.json       # 依赖锁定
└── sample_data/            # 10 个预置 Excel 样本文件
    ├── 01_stationary_AR2.xlsx      # 平稳 AR(2) 序列
    ├── 02_nonstationary_trend.xlsx # 带趋势非平稳序列
    ├── 03_seasonal_12period.xlsx   # 强季节性周期
    ├── 04_with_missing_values.xlsx # 含缺失值
    ├── 05_with_outliers.xlsx       # 含异常值
    ├── 06_white_noise.xlsx         # 纯白噪声（无法建模）
    ├── 07_MA1_process.xlsx         # MA(1) 过程
    ├── 08_ARMA_1_1.xlsx            # ARMA(1,1) 混合过程
    ├── 09_small_sample.xlsx        # 小样本（不足最小样本量）
    └── 10_multi_column.xlsx        # 多列数据，测试列选择
```

---

## 📖 使用流程

1. **打开页面** → 看到参数配置区与上传区
2. **调整参数**（可选）— 显著性水平 α、差分上限、p/q 阶数范围等
3. **上传 Excel** — 拖拽或点击上传 `.xlsx` 文件
4. **选择列** — 指定「数值列」（必填）与「时间列」（可选）
5. **点击「开始分析」**
6. **查看每步结果** — 8 步会依次显示表格与图表
7. **最终结果** — 绿色面板展示最优模型、评价指标与未来 12 期预测

> 若数据存在明显问题（缺失值过多、样本不足、白噪声等），会在对应步骤给出清晰提示并终止分析。

---

## 🔬 核心算法

### 平稳性检验
- **Augmented Dickey-Fuller (ADF) 检验** — 单位根检验判断序列是否平稳
- 自动差分策略：若不平稳则逐阶差分，最多到 `d_max`

### 阶数识别
- **ACF / PACF** — 基于 Bartlett 近似的显著性阈值识别显著滞后
- **AIC / BIC 网格搜索** — 对 p ∈ [p_min, p_max]、q ∈ [q_min, q_max] 全组合计算，取信息准则最小者

### 参数估计
- **极大似然估计 (MLE)** — 采用条件似然 + 数值优化（Newton-Raphson / 网格搜索）
- 系数显著性检验 — 基于参数估计 / 标准误的 z 检验

### 残差诊断
- **Ljung-Box Q 统计量** — 检验残差是否无显著自相关
- 残差 ACF/PACF 可视化辅助判断

### 预测评估
- 样本内拟合 vs 样本外预测对比
- 指标：MAE、MSE、RMSE、MAPE
- 过拟合预警：测试集 RMSE / 训练集 RMSE 比值 > 3 时告警

---

## 📦 安装依赖（仅用于生成样本）

```bash
npm install     # 安装 xlsx 依赖（运行 generate_samples.js 需要）
```

网页分析本身 **不需要** 任何本地安装，所有依赖通过 CDN 加载。

---

## 🧪 运行测试

```bash
# 统计函数单元测试
node test_stats.js

# 完整流程端到端测试
node test_full.js
```

---

## 📝 许可证

ISC License — 详见 [LICENSE](https://opensource.org/licenses/ISC)

---

## 💡 致谢

- [SheetJS](https://sheetjs.com/) — 强大的 Excel 解析库
- [Chart.js](https://www.chartjs.org/) — 简洁优雅的图表库
