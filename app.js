// ============================================================
// ARIMA 时序分析主应用 - 分步展示版
// ============================================================

(function () {
  const TOTAL_STEPS = 10; // 步骤 0 ~ 9

  // 全局状态
  let rawData = [];
  let headers = [];
  let selectedValues = [];
  let charts = {};
  let currentStep = 0;
  let analysisResult = null;

  // DOM 引用
  const fileInput = document.getElementById("fileInput");
  const chooseFileBtn = document.getElementById("chooseFileBtn");
  const uploadArea = document.getElementById("uploadArea");
  const fileName = document.getElementById("fileName");
  const valueColumnSelect = document.getElementById("valueColumn");
  const dateColumnSelect = document.getElementById("dateColumn");
  const varSelectCard = document.getElementById("varSelectCard");
  const dataPreview = document.getElementById("dataPreview");
  const startAnalysisBtn = document.getElementById("startAnalysisBtn");
  const progressFill = document.getElementById("progressFill");

  // ============================================================
  // 初始化：步骤导航交互
  // ============================================================
  document.querySelectorAll(".step-item").forEach((item) => {
    item.addEventListener("click", () => {
      const step = parseInt(item.dataset.step);
      if (step <= currentStep) goToStep(step);
    });
  });

  // "返回" 按钮
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = parseInt(btn.dataset.goto);
      goToStep(target);
    });
  });

  // "继续下一步" 按钮
  const nextButtons = [
    { id: "toStep2Btn", step: 2 },
    { id: "toStep3Btn", step: 3 },
    { id: "toStep4Btn", step: 4 },
    { id: "toStep5Btn", step: 5 },
    { id: "toStep6Btn", step: 6 },
    { id: "toStep7Btn", step: 7 },
    { id: "toStep8Btn", step: 8 },
    { id: "toStep9Btn", step: 9 },
  ];
  nextButtons.forEach((nb) => {
    const el = document.getElementById(nb.id);
    if (el) {
      el.addEventListener("click", () => goToStep(nb.step));
    }
  });

  // "重新开始"
  const restartBtn = document.getElementById("restartBtn");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      location.reload();
    });
  }

  // 导出分析结果
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportAnalysisReport);
  }

  // 查看分析详情：跳回步骤 1
  const viewDetailsBtn = document.getElementById("viewDetailsBtn");
  if (viewDetailsBtn) {
    viewDetailsBtn.addEventListener("click", () => goToStep(1));
  }

  // 上传文件按钮
  if (chooseFileBtn) {
    chooseFileBtn.addEventListener("click", () => fileInput.click());
  }

  // 拖拽上传
  if (uploadArea) {
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
  }

  // 数值列切换时，更新预览
  if (valueColumnSelect) {
    valueColumnSelect.addEventListener("change", renderPreview);
  }

  // 开始分析
  if (startAnalysisBtn) {
    startAnalysisBtn.addEventListener("click", () => {
      const valIdx = parseInt(valueColumnSelect.value);
      selectedValues = rawData.map((row) => parseFloat(row[valIdx])).filter((v) => !isNaN(v));
      if (selectedValues.length < 2) {
        showModal("数据解析失败", "<p>无法从所选列中解析出有效的数值。</p>");
        return;
      }
      runAllAnalysis();
    });
  }

  // ============================================================
  // 文件解析
  // ============================================================
  function handleFile(file) {
    fileName.textContent = "📄 " + file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (json.length < 2) {
          showModal("数据不足", "<p>文件至少需要两行（表头 + 数据）。</p>");
          return;
        }
        headers = json[0].map((h, i) => h || `列 ${i + 1}`);
        rawData = json.slice(1).filter((row) => row.some((v) => v !== "" && v !== null && v !== undefined));
        populateColumnSelectors();
        renderPreview();
        varSelectCard.style.display = "block";
        startAnalysisBtn.disabled = false;
      } catch (err) {
        showModal("文件解析失败", `<p>${err.message}</p>`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function populateColumnSelectors() {
    valueColumnSelect.innerHTML = "";
    dateColumnSelect.innerHTML = '<option value="">无（使用序号）</option>';
    headers.forEach((h, idx) => {
      const opt1 = document.createElement("option");
      opt1.value = idx;
      opt1.textContent = h;
      valueColumnSelect.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = idx;
      opt2.textContent = h;
      dateColumnSelect.appendChild(opt2);
    });
    if (headers.length >= 2) valueColumnSelect.selectedIndex = 1;
  }

  function renderPreview() {
    const maxRows = Math.min(rawData.length, 10);
    const valIdx = parseInt(valueColumnSelect.value);
    let html = '<table><thead><tr>';
    headers.forEach((h) => (html += `<th>${h}</th>`));
    html += '</tr></thead><tbody>';
    for (let i = 0; i < maxRows; i++) {
      html += '<tr>';
      headers.forEach((_, j) => {
        const v = rawData[i][j];
        const highlight = (j === valIdx) ? ' style="background:#dbeafe;font-weight:600;"' : '';
        html += `<td${highlight}>${v ?? ''}</td>`;
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += `<p style="margin-top:10px;color:#64748b;font-size:13px;">共 ${rawData.length} 行数据，显示前 ${maxRows} 行</p>`;
    dataPreview.innerHTML = html;
  }

  // ============================================================
  // 分步执行分析
  // ============================================================
  async function runAllAnalysis() {
    analysisResult = { series: selectedValues.slice() };
    const PAUSE_MS = 75; // 每步暂停时间，让用户能看清中间结果

    // ---------- 步骤 1：数据校验 ----------
    goToStep(1);
    // await sleep(PAUSE_MS);
    const s1 = step1_validateData();
    if (s1.terminate) {
      renderStepError(1, s1.message);
      return;
    }
    markStepDone(1);
    enableNext(1);
    await sleep(PAUSE_MS);

    // ---------- 步骤 2：季节性初判 ----------
    goToStep(2);
    // await sleep(PAUSE_MS);
    const s2 = step2_detectSeasonality();
    if (s2.switchToSARIMA) {
      renderStepError(2, s2.message);
      return;
    }
    markStepDone(2);
    enableNext(2);
    await sleep(PAUSE_MS);

    // ---------- 步骤 3：平稳性 & 差分 ----------
    goToStep(3);
    // await sleep(PAUSE_MS);
    const s3 = step3_stationarity();
    if (s3.terminate) {
      renderStepError(3, s3.message);
      return;
    }
    analysisResult.d = s3.d;
    analysisResult.stationarySeries = s3.stationarySeries;
    markStepDone(3);
    enableNext(3);
    await sleep(PAUSE_MS);

    // ---------- 步骤 4：ACF / PACF ----------
    goToStep(4);
    // await sleep(PAUSE_MS);
    const s4 = step4_acfPacf();
    if (s4.terminate) {
      renderStepError(4, s4.message);
      return;
    }
    markStepDone(4);
    enableNext(4);
    await sleep(PAUSE_MS);

    // ---------- 步骤 5：p / q 阶数寻优 ----------
    goToStep(5);
    // await sleep(PAUSE_MS);
    const s5 = step5_selectOrder();
    if (s5.terminate) {
      renderStepError(5, s5.message);
      return;
    }
    analysisResult.bestP = s5.best.p;
    analysisResult.bestQ = s5.best.q;
    analysisResult.step5 = { best: s5.best, grid: s5.grid };
    markStepDone(5);
    enableNext(5);
    await sleep(PAUSE_MS);

    // ---------- 步骤 6：模型拟合 ----------
    goToStep(6);
    // await sleep(PAUSE_MS);
    const s6 = step6_fitModel();
    if (s6.terminate) {
      renderStepError(6, s6.message);
      return;
    }
    analysisResult.finalModel = s6.finalModel;
    analysisResult.finalP = s6.finalP;
    analysisResult.finalQ = s6.finalQ;
    markStepDone(6);
    enableNext(6);
    await sleep(PAUSE_MS);

    // ---------- 步骤 7：残差白噪声 ----------
    goToStep(7);
    // await sleep(PAUSE_MS);
    const s7 = step7_residualTest();
    if (s7.terminate) {
      renderStepError(7, s7.message);
      return;
    }
    analysisResult.residual = s7;
    markStepDone(7);
    enableNext(7);
    await sleep(PAUSE_MS);

    // ---------- 步骤 8：预测效果评估 ----------
    goToStep(8);
    // await sleep(PAUSE_MS);
    const s8 = step8_forecastEval();
    if (s8.terminate) {
      renderStepError(8, s8.message);
      return;
    }
    analysisResult.forecast = s8;
    markStepDone(8);
    enableNext(8);
    await sleep(PAUSE_MS);

    // ---------- 步骤 9：汇总 ----------
    goToStep(9);
    // await sleep(PAUSE_MS);
    renderFinalSummary();
    markStepDone(9);

    // 启用导出按钮
    if (exportBtn) exportBtn.disabled = false;

    // 分析完成数秒后，跳回步骤 1，以便用户查看完整中间过程
    // await sleep(2500);
    // goToStep(1);
  }

  // ============================================================
  // 步骤 1：数据校验
  // ============================================================
  function step1_validateData() {
    const values = selectedValues;
    const n = values.length;
    const minSample = parseInt(document.getElementById("minsample").value) || 30;

    const container = document.getElementById("step1-output");
    const content = [];
    content.push(`<div class="card"><h3>📊 基础统计</h3>`);
    content.push(`<div class="check-grid">`);
    content.push(`<div class="check-item ${n >= minSample ? 'pass' : 'fail'}"><span class="check-label">样本量</span><span class="check-value">${n}（要求 ≥ ${minSample}）</span></div>`);

    const m = Stats.mean(values);
    const std = Stats.stddev(values);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    content.push(`<div class="check-item pass"><span class="check-label">均值</span><span class="check-value">${m.toFixed(4)}</span></div>`);
    content.push(`<div class="check-item pass"><span class="check-label">标准差</span><span class="check-value">${std.toFixed(4)}</span></div>`);
    content.push(`<div class="check-item pass"><span class="check-label">最小值 / 最大值</span><span class="check-value">${minV.toFixed(4)} / ${maxV.toFixed(4)}</span></div>`);
    content.push(`</div></div>`);

    // 缺失值
    const missingCount = values.filter((v) => v === null || v === undefined || isNaN(v)).length;
    const outliers = Stats.detectOutliers(values);
    content.push(`<div class="card"><h3>🔍 质量检查</h3>`);
    content.push(`<div class="check-grid">`);
    if (missingCount > 0) {
      content.push(`<div class="check-item fail"><span class="check-label">缺失值</span><span class="check-value">${missingCount} 处，请补齐后重新上传</span></div>`);
    } else {
      content.push(`<div class="check-item pass"><span class="check-label">缺失值</span><span class="check-value">✓ 未发现缺失值</span></div>`);
    }
    if (outliers.length > 0) {
      content.push(`<div class="check-item warn"><span class="check-label">潜在异常值（3σ）</span><span class="check-value">${outliers.length} 个（位置示例：${outliers.slice(0, 5).map((o) => o.index + 1).join(", ")}${outliers.length > 5 ? "..." : ""}）</span></div>`);
    } else {
      content.push(`<div class="check-item pass"><span class="check-label">异常值</span><span class="check-value">✓ 无明显异常</span></div>`);
    }
    content.push(`</div></div>`);

    content.push(`<div class="card"><h3>📈 原始时序图</h3>`);
    content.push(`<div class="chart-container"><canvas id="step1-chart"></canvas></div></div>`);

    container.innerHTML = content.join("");

    setTimeout(() => renderTimeSeriesChart(values, "原始时序", "step1-chart"), 100);

    // 保存导出数据
    analysisResult.step1 = {
      n, minSample, mean: m, std, min: minV, max: maxV,
      missingCount, outliers: outliers.length, rawData: values.slice()
    };

    if (n < minSample || missingCount > 0) {
      return {
        terminate: true,
        message: `数据校验未通过（样本量不足或存在缺失值），请补充数据后重试。`,
      };
    }
    return { terminate: false, message: "数据校验通过" };
  }

  // ============================================================
  // 步骤 2：季节性初判
  // ============================================================
  function step2_detectSeasonality() {
    const values = selectedValues;
    const season = Stats.detectSeasonality(values);
    const container = document.getElementById("step2-output");
    const content = [];
    content.push(`<div class="card"><h3>🌊 季节性特征检测</h3>`);
    content.push(`<div class="info-box"><p>基于 ACF 在滞后 4 ~ ${Math.floor(values.length / 4)} 范围内寻找显著峰值，如存在多个大于 0.3 的相关峰，提示强季节性，应改用 SARIMA。</p></div>`);

    if (season.hasSeasonality) {
      content.push(`<div class="warning-box">⚠ 检测到显著季节性特征（疑似周期 ≈ ${season.period}）。建议使用 SARIMA 模型；继续以普通 ARIMA 分析时，结果可能不可靠。</div>`);
    } else {
      content.push(`<div class="success-box">✓ 未检测到显著季节性特征，可继续使用普通 ARIMA。</div>`);
    }
    content.push(`<p style="margin-top:10px;">显著性阈值（95% CI）：±${season.ci.toFixed(4)}</p>`);
    if (season.acfPeaks.length > 0) {
      content.push(`<div class="table-scroll"><table class="result-table"><thead><tr><th>滞后阶</th><th>ACF 值</th></tr></thead><tbody>`);
      season.acfPeaks.slice(0, 10).forEach((p) => {
        content.push(`<tr><td>${p.lag}</td><td>${p.value.toFixed(4)}</td></tr>`);
      });
      content.push(`</tbody></table></div>`);
    }
    content.push(`</div>`);
    container.innerHTML = content.join("");

    // 保存导出数据
    analysisResult.step2 = {
      hasSeasonality: season.hasSeasonality,
      period: season.period,
      ci: season.ci,
      peaks: season.acfPeaks.slice(0, 10).map((p) => ({ lag: p.lag, acf: p.value }))
    };

    return { switchToSARIMA: season.hasSeasonality, message: "季节性初判完成" };
  }

  // ============================================================
  // 步骤 3：平稳性检验 & 差分
  // ============================================================
  function step3_stationarity() {
    const values = selectedValues;
    const maxD = parseInt(document.getElementById("dmax").value) || 2;
    const alpha = parseFloat(document.getElementById("alpha").value) || 0.05;
    let currentSeries = values.slice();
    let d = 0;
    const container = document.getElementById("step3-output");
    const content = [];
    content.push(`<div class="card"><h3>🧪 ADF 平稳性检验</h3>`);

    while (d <= maxD) {
      const adf = Stats.adfTest(currentSeries);
      const label = d === 0 ? "原序列" : `${d} 阶差分后`;
      content.push(`<div class="info-box"><p><strong>${label}：</strong></p>`);
      content.push(`<p>ADF 统计量 t = ${adf.stat.toFixed(4)}，p 值 ≈ ${adf.pValue.toFixed(4)}</p>`);
      content.push(`<p>临界值（1%）：${adf.critical["0.01"].toFixed(4)}；（5%）：${adf.critical["0.05"].toFixed(4)}；（10%）：${adf.critical["0.10"].toFixed(4)}</p>`);
      if (adf.pValue < alpha) {
        content.push(`<div class="success-box">✓ p < α = ${alpha}，序列平稳，停止差分。</div>`);
        content.push(`</div>`);
        break;
      } else {
        content.push(`<div class="warning-box">⚠ p ≥ α = ${alpha}，继续差分。</div>`);
        content.push(`</div>`);
        d++;
        if (d > maxD) break;
        currentSeries = Stats.diff(currentSeries, 1);
      }
    }

    if (d > maxD) {
      content.push(`<div class="danger-box">❌ 经过 ${maxD} 次差分仍无法平稳，不满足 ARIMA 前提。</div>`);
      container.innerHTML = content.join("");
      return { terminate: true, message: `经 ${maxD} 次差分仍不平稳` };
    }

    content.push(`<h4 style="margin-top:16px;">差分后序列图</h4>`);
    content.push(`<div class="chart-container"><canvas id="step3-chart"></canvas></div>`);
    content.push(`</div>`);
    container.innerHTML = content.join("");
    setTimeout(() => renderTimeSeriesChart(currentSeries, d === 0 ? "平稳序列（原序列）" : `${d} 阶差分后`, "step3-chart"), 100);

    return {
      terminate: false,
      message: `确定差分阶数 d = ${d}`,
      d: d,
      stationarySeries: currentSeries,
    };
  }

  // ============================================================
  // 步骤 4：ACF / PACF
  // ============================================================
  function step4_acfPacf() {
    const series = analysisResult.stationarySeries;
    const maxLag = Math.min(40, Math.floor(series.length / 3));
    const acfVals = Stats.acf(series, maxLag);
    const pacfVals = Stats.pacf(series, maxLag);
    const ci = 1.96 / Math.sqrt(series.length);
    const container = document.getElementById("step4-output");
    const content = [];

    let seasonalPeaks = 0;
    for (let lag = 2; lag < maxLag; lag++) {
      if (Math.abs(acfVals[lag]) > ci && Math.abs(acfVals[lag]) > 0.3) seasonalPeaks++;
    }
    let significantCount = 0;
    for (let lag = 1; lag <= Math.min(10, maxLag); lag++) {
      if (Math.abs(acfVals[lag]) > ci) significantCount++;
      if (Math.abs(pacfVals[lag]) > ci) significantCount++;
    }

    content.push(`<div class="card"><h3>📉 ACF / PACF 分析</h3>`);
    content.push(`<div class="info-box"><p>置信区间：±${ci.toFixed(4)}</p><p>显著相关滞后数：${significantCount}</p></div>`);

    const pacfCutoff = findCutoff(pacfVals, ci);
    const acfCutoff = findCutoff(acfVals, ci);
    if (pacfCutoff > 0 && acfCutoff < 0) {
      content.push(`<div class="success-box">✓ PACF 疑似在 ${pacfCutoff} 阶截尾，ACF 拖尾 → 符合 AR 特征，建议 p ≈ ${pacfCutoff}。</div>`);
    } else if (acfCutoff > 0 && pacfCutoff < 0) {
      content.push(`<div class="success-box">✓ ACF 疑似在 ${acfCutoff} 阶截尾，PACF 拖尾 → 符合 MA 特征，建议 q ≈ ${acfCutoff}。</div>`);
    } else if (acfCutoff > 0 && pacfCutoff > 0) {
      content.push(`<div class="success-box">✓ ACF / PACF 均有截尾特征（p ≈ ${pacfCutoff}，q ≈ ${acfCutoff}）→ 符合 ARMA。</div>`);
    } else if (significantCount === 0) {
      content.push(`<div class="danger-box">❌ ACF / PACF 无任何显著相关，序列近似白噪声，无法建模。</div>`);
      container.innerHTML = content.join("");
      return { terminate: true, message: "ACF / PACF 无规律" };
    } else {
      content.push(`<div class="info-box">ℹ ACF / PACF 无明显截尾，将通过 AIC/BIC 网格搜索确定 (p, q)。</div>`);
    }

    if (seasonalPeaks >= 4) {
      content.push(`<div class="warning-box">⚠ ACF 中有多个显著峰值，可能存在隐性季节性。</div>`);
    }

    content.push(`<div class="chart-row"><div class="chart-container"><canvas id="acf-canvas"></canvas></div><div class="chart-container"><canvas id="pacf-canvas"></canvas></div></div>`);
    content.push(`</div>`);
    container.innerHTML = content.join("");
    setTimeout(() => {
      renderBarChart(acfVals, ci, "ACF", "acf-canvas");
      renderBarChart(pacfVals, ci, "PACF", "pacf-canvas");
    }, 100);

    return { terminate: false, message: "ACF / PACF 分析完成", acf: acfVals, pacf: pacfVals };
  }

  // ============================================================
  // 步骤 5：p / q 阶数寻优
  // ============================================================
  function step5_selectOrder() {
    const series = analysisResult.stationarySeries;
    const pMax = Math.min(parseInt(document.getElementById("pqmax").value) || 5, 8);
    const qMax = pMax;
    const pMin = parseInt(document.getElementById("pqmin").value) || 0;
    const grid = [];
    let best = { p: 0, q: 0, aic: Infinity, bic: Infinity };
    const container = document.getElementById("step5-output");
    const content = [];

    for (let p = pMin; p <= pMax; p++) {
      for (let q = pMin; q <= qMax; q++) {
        try {
          const fit = Stats.fitARIMA(series, p, q);
          if (!fit || !fit.success) continue;
          const aicVal = Stats.aic(fit.residuals, p + q);
          const bicVal = Stats.bic(fit.residuals, p + q);
          if (!isFinite(aicVal) || !isFinite(bicVal)) continue;
          grid.push({ p: p, q: q, aic: aicVal, bic: bicVal });
          if (aicVal < best.aic) best = { p: p, q: q, aic: aicVal, bic: bicVal };
        } catch (e) {
          continue;
        }
      }
    }

    if (grid.length === 0) {
      content.push(`<div class="danger-box">❌ 所有 (p, q) 组合拟合失败。</div>`);
      container.innerHTML = content.join("");
      return { terminate: true, message: "所有 (p, q) 组合拟合失败" };
    }

    const minAic = best.aic;
    const closeModels = grid.filter((m) => Math.abs(m.aic - minAic) < 2);
    if (closeModels.length > 1) {
      closeModels.sort((a, b) => (a.p + a.q) - (b.p + b.q));
      best = closeModels[0];
    }

    content.push(`<div class="card"><h3>🎯 最优阶数确定</h3>`);
    content.push(`<div class="info-box"><p><strong>搜索范围：</strong>p ∈ [${pMin}, ${pMax}]，q ∈ [${pMin}, ${qMax}]</p><p>按 AIC 最小（相近时取简约模型）原则选择。</p></div>`);
    content.push(`<div class="success-box"><p><strong>最优模型：</strong>ARIMA(${best.p}, ${analysisResult.d}, ${best.q})，AIC = ${best.aic.toFixed(2)}，BIC = ${best.bic.toFixed(2)}</p></div>`);

    // AIC 网格表
    const ps = [...new Set(grid.map((g) => g.p))].sort((a, b) => a - b);
    const qs = [...new Set(grid.map((g) => g.q))].sort((a, b) => a - b);
    const gridMap = {};
    grid.forEach((g) => (gridMap[`${g.p}_${g.q}`] = g));
    content.push(`<h4 style="margin-top:16px;">AIC / BIC 全量表</h4>`);
    content.push(`<div class="table-scroll"><table class="result-table"><thead><tr><th>p \\ q</th>`);
    qs.forEach((q) => (content.push(`<th>${q}</th>`)));
    content.push(`</tr></thead><tbody>`);
    ps.forEach((p) => {
      content.push(`<tr><th>${p}</th>`);
      qs.forEach((q) => {
        const cell = gridMap[`${p}_${q}`];
        if (cell) {
          const isBest = p === best.p && q === best.q;
          content.push(`<td${isBest ? ' style="background:#d1fae5;font-weight:600;"' : ""}>AIC: ${cell.aic.toFixed(1)}<br>BIC: ${cell.bic.toFixed(1)}</td>`);
        } else {
          content.push(`<td style="color:#cbd5e1;">—</td>`);
        }
      });
      content.push(`</tr>`);
    });
    content.push(`</tbody></table></div>`);
    content.push(`</div>`);
    container.innerHTML = content.join("");

    return { terminate: false, message: `最优 (p, q) = (${best.p}, ${best.q})`, best: best, grid: grid };
  }

  // ============================================================
  // 步骤 6：模型拟合 + 合法性校验
  // ============================================================
  function step6_fitModel() {
    const series = analysisResult.stationarySeries;
    const p = analysisResult.bestP;
    const q = analysisResult.bestQ;
    const d = analysisResult.d;
    const alpha = parseFloat(document.getElementById("alpha").value) || 0.05;
    const container = document.getElementById("step6-output");
    const content = [];
    const model = Stats.fitARIMA(series, p, q);

    content.push(`<div class="card"><h3>🧱 模型拟合：ARIMA(${p}, ${d}, ${q})</h3>`);
    if (!model || !model.success) {
      content.push(`<div class="danger-box">❌ 模型拟合失败。</div>`);
      container.innerHTML = content.join("");
      return { terminate: true, message: "模型拟合失败" };
    }

    const se = model.se || [];
    const pvals = model.pValues || [];
    const arCoefs = model.arCoefs || [];
    const maCoefs = model.maCoefs || [];

    content.push(`<table class="coefficients-table"><thead><tr><th>参数</th><th>估计值</th><th>标准误</th><th>p 值</th><th>显著性</th></tr></thead><tbody>`);
    for (let i = 0; i < p; i++) {
      const sig = pvals[i] < alpha;
      content.push(`<tr><td>AR(${i + 1})</td><td>${arCoefs[i].toFixed(4)}</td><td>${se[i] ? se[i].toFixed(4) : "—"}</td><td>${pvals[i] ? pvals[i].toFixed(4) : "—"}</td><td class="${sig ? "significant" : "not-significant"}">${sig ? "✓ 显著" : "✗ 不显著"}</td></tr>`);
    }
    for (let j = 0; j < q; j++) {
      const idx = p + j;
      const sig = pvals[idx] < alpha;
      content.push(`<tr><td>MA(${j + 1})</td><td>${maCoefs[j].toFixed(4)}</td><td>${se[idx] ? se[idx].toFixed(4) : "—"}</td><td>${pvals[idx] ? pvals[idx].toFixed(4) : "—"}</td><td class="${sig ? "significant" : "not-significant"}">${sig ? "✓ 显著" : "✗ 不显著"}</td></tr>`);
    }
    content.push(`</tbody></table>`);

    content.push(`<div class="info-box" style="margin-top:16px;">`);
    content.push(`<p><strong>残差方差 σ²：</strong>${model.sigma2.toFixed(4)}</p>`);
    content.push(`<p><strong>有效观测：</strong>${model.numObs || series.length}</p>`);
    content.push(`<p><strong>AR 平稳性：</strong>${model.arStationary !== false ? "✓ 满足" : "✗ 不满足"}</p>`);
    content.push(`<p><strong>MA 可逆性：</strong>${model.maInvertible !== false ? "✓ 满足" : "✗ 不满足"}</p>`);
    content.push(`</div></div>`);
    container.innerHTML = content.join("");

    if (model.arStationary === false || model.maInvertible === false) {
      return { terminate: true, message: "模型不满足平稳/可逆条件" };
    }
    return { terminate: false, message: "模型拟合成功", finalModel: model, finalP: p, finalQ: q };
  }

  // ============================================================
  // 步骤 7：残差白噪声检验
  // ============================================================
  function step7_residualTest() {
    const model = analysisResult.finalModel;
    const series = analysisResult.stationarySeries;
    const alpha = parseFloat(document.getElementById("alpha").value) || 0.05;
    const residuals = model.residuals;
    const testLag = Math.min(24, Math.floor(series.length / 4));
    const lb = Stats.ljungBoxTest(residuals, testLag);
    const container = document.getElementById("step7-output");
    const content = [];

    content.push(`<div class="card"><h3>🔍 Ljung-Box 白噪声检验</h3>`);
    content.push(`<div class="info-box"><p>检验滞后阶：${testLag}</p><p>Q 统计量 = ${lb.Q.toFixed(4)}，自由度 = ${lb.df}，p 值 = ${lb.pValue.toFixed(4)}</p></div>`);

    if (lb.pValue > alpha) {
      content.push(`<div class="success-box">✓ p > α = ${alpha}，残差为白噪声 → 模型有效。</div>`);
    } else {
      content.push(`<div class="warning-box">⚠ p ≤ α = ${alpha}，残差存在自相关，模型可能未充分提取信息。</div>`);
    }

    const resMean = Stats.mean(residuals);
    const resStd = Stats.stddev(residuals);
    content.push(`<div class="info-box" style="margin-top:14px;"><p><strong>残差统计：</strong></p><p>均值 ≈ ${resMean.toFixed(6)}（理想接近 0）</p><p>标准差 ≈ ${resStd.toFixed(4)}</p></div>`);
    content.push(`<h4 style="margin-top:14px;">残差序列图</h4>`);
    content.push(`<div class="chart-container"><canvas id="step7-chart"></canvas></div></div>`);
    container.innerHTML = content.join("");
    setTimeout(() => renderTimeSeriesChart(residuals, "残差", "step7-chart"), 100);

    return { terminate: lb.pValue <= alpha && lb.pValue <= alpha / 3, message: `残差检验完成（p = ${lb.pValue.toFixed(4)}）`, lb: lb };
  }

  // ============================================================
  // 步骤 8：样本内 / 样本外预测评估
  // ============================================================
  function step8_forecastEval() {
    const origSeries = selectedValues;
    const stationarySeries = analysisResult.stationarySeries;
    const model = analysisResult.finalModel;
    const p = analysisResult.finalP;
    const q = analysisResult.finalQ;
    const d = analysisResult.d;
    const testRatio = parseFloat(document.getElementById("testratio").value) || 0.2;

    const n = origSeries.length;
    const testSize = Math.max(1, Math.floor(n * testRatio));
    const trainSize = n - testSize;
    const trainOrig = origSeries.slice(0, trainSize);
    const testOrig = origSeries.slice(trainSize);

    let trainStationary = trainOrig.slice();
    for (let i = 0; i < d; i++) trainStationary = Stats.diff(trainStationary, 1);
    const trainModel = Stats.fitARIMA(trainStationary, p, q);
    if (!trainModel || !trainModel.success) {
      const container = document.getElementById("step8-output");
      container.innerHTML = `<div class="card"><div class="danger-box">❌ 训练集上重新拟合失败。</div></div>`;
      return { terminate: true, message: "训练集拟合失败" };
    }

    const outSamplePred = Stats.forecastARIMA(trainModel, trainStationary, testSize, trainOrig.slice(-Math.max(d, 1) - 1), d);
    const inSampleFittedStationary = Stats.fittedValuesARIMA(model, stationarySeries);
    const inSampleFitted = invertFitToOriginal(inSampleFittedStationary, origSeries, stationarySeries, d);

    const outMetrics = Stats.forecastMetrics(testOrig, outSamplePred);
    const inAligned = alignFitted(origSeries, inSampleFitted, d, Math.max(p, q));
    const inMetrics = Stats.forecastMetrics(inAligned.actual, inAligned.pred);

    const ratio = outMetrics.RMSE / (inMetrics.RMSE || 1);
    const container = document.getElementById("step8-output");
    const content = [];
    content.push(`<div class="card"><h3>📈 训练 / 测试划分</h3>`);
    content.push(`<div class="info-box"><p>训练集大小：${trainSize}（前 ${((trainSize / n) * 100).toFixed(1)}%）</p><p>测试集大小：${testSize}（后 ${((testSize / n) * 100).toFixed(1)}%）</p></div></div>`);

    content.push(`<div class="card"><h3>✅ 样本内拟合指标</h3>`);
    content.push(`<table class="metrics-table"><thead><tr><th>指标</th><th>值</th></tr></thead><tbody>`);
    content.push(`<tr><td>MAE</td><td>${inMetrics.MAE.toFixed(4)}</td></tr>`);
    content.push(`<tr><td>MSE</td><td>${inMetrics.MSE.toFixed(4)}</td></tr>`);
    content.push(`<tr><td>RMSE</td><td>${inMetrics.RMSE.toFixed(4)}</td></tr>`);
    if (!isNaN(inMetrics.MAPE)) content.push(`<tr><td>MAPE</td><td>${inMetrics.MAPE.toFixed(2)}%</td></tr>`);
    content.push(`</tbody></table></div>`);

    content.push(`<div class="card"><h3>🔮 样本外预测指标</h3>`);
    content.push(`<table class="metrics-table"><thead><tr><th>指标</th><th>值</th></tr></thead><tbody>`);
    content.push(`<tr><td>MAE</td><td>${outMetrics.MAE.toFixed(4)}</td></tr>`);
    content.push(`<tr><td>MSE</td><td>${outMetrics.MSE.toFixed(4)}</td></tr>`);
    content.push(`<tr><td>RMSE</td><td>${outMetrics.RMSE.toFixed(4)}</td></tr>`);
    if (!isNaN(outMetrics.MAPE)) content.push(`<tr><td>MAPE</td><td>${outMetrics.MAPE.toFixed(2)}%</td></tr>`);
    content.push(`</tbody></table>`);

    content.push(`<div class="info-box" style="margin-top:14px;">`);
    content.push(`<p><strong>泛化能力评估：</strong>测试集 RMSE / 训练集 RMSE ≈ ${ratio.toFixed(3)}</p>`);
    if (ratio > 3) {
      content.push(`<div class="warning-box">⚠ 比值过大（> 3），疑似过拟合。</div>`);
    } else if (ratio > 1.5) {
      content.push(`<p>模型泛化能力一般。</p>`);
    } else {
      content.push(`<div class="success-box">✓ 模型泛化能力良好。</div>`);
    }
    content.push(`</div>`);

    content.push(`<h4 style="margin-top:14px;">实际值 vs 拟合值 vs 预测值</h4>`);
    content.push(`<div class="chart-container" style="height:380px;"><canvas id="step8-chart"></canvas></div></div>`);
    container.innerHTML = content.join("");
    setTimeout(() => renderForecastChart({ testOrig, outSamplePred, inSampleActual: inAligned.actual, inSamplePred: inAligned.pred, trainSize, testSize }, "step8-chart"), 100);

    return {
      terminate: ratio > 5,
      message: `预测评估完成`,
      trainSize,
      testSize,
      testActual: testOrig,
      testPred: outSamplePred,
      inSampleActual: inAligned.actual,
      inSamplePred: inAligned.pred,
      inMetrics,
      outMetrics,
    };
  }

  // ============================================================
  // 步骤 9：最终汇总
  // ============================================================
  function renderFinalSummary() {
    const model = analysisResult.finalModel;
    const p = analysisResult.finalP;
    const d = analysisResult.d;
    const q = analysisResult.finalQ;
    const out = analysisResult.forecast.outMetrics;
    const aicVal = Stats.aic(model.residuals, p + q);
    const bicVal = Stats.bic(model.residuals, p + q);
    const container = document.getElementById("step9-output");
    const content = [];

    content.push(`<div class="summary-final"><h3>🎉 最终模型：ARIMA(${p}, ${d}, ${q})</h3>`);
    content.push(`<div class="result-grid">`);
    content.push(`<div class="result-card"><div class="label">模型阶数</div><div class="value">(${p}, ${d}, ${q})</div></div>`);
    content.push(`<div class="result-card"><div class="label">AIC</div><div class="value">${aicVal.toFixed(2)}</div></div>`);
    content.push(`<div class="result-card"><div class="label">BIC</div><div class="value">${bicVal.toFixed(2)}</div></div>`);
    content.push(`<div class="result-card"><div class="label">残差方差 σ²</div><div class="value">${model.sigma2.toFixed(4)}</div></div>`);
    if (out && !isNaN(out.MAPE)) content.push(`<div class="result-card"><div class="label">测试集 MAPE</div><div class="value">${out.MAPE.toFixed(2)}%</div></div>`);
    if (out) content.push(`<div class="result-card"><div class="label">测试集 RMSE</div><div class="value">${out.RMSE.toFixed(4)}</div></div>`);
    content.push(`</div>`);

    // 未来 12 期预测
    const futureSteps = 12;
    let stationaryFull = selectedValues.slice();
    for (let i = 0; i < d; i++) stationaryFull = Stats.diff(stationaryFull, 1);
    const futurePred = Stats.forecastARIMA(model, stationaryFull, futureSteps, selectedValues.slice(-Math.max(d, 1) - 1), d);

    content.push(`<div class="card" style="margin-top:20px;"><h3>🔮 未来 ${futureSteps} 期预测</h3>`);
    content.push(`<div class="table-scroll"><table class="result-table"><thead><tr><th>期数</th><th>预测值</th></tr></thead><tbody>`);
    for (let i = 0; i < futurePred.length; i++) {
      content.push(`<tr><td>第 ${selectedValues.length + i + 1} 期</td><td>${futurePred[i].toFixed(4)}</td></tr>`);
    }
    content.push(`</tbody></table></div></div>`);

    content.push(`<div class="card"><h3>📋 模型诊断摘要</h3>`);
    content.push(`<table class="result-table"><tbody>`);
    content.push(`<tr><td style="width:50%;">AR 平稳性</td><td>${model.arStationary !== false ? "✓ 满足" : "✗ 不满足"}</td></tr>`);
    content.push(`<tr><td>MA 可逆性</td><td>${model.maInvertible !== false ? "✓ 满足" : "✗ 不满足"}</td></tr>`);
    const lb = analysisResult.residual && analysisResult.residual.lb;
    content.push(`<tr><td>残差白噪声</td><td>${lb ? `p = ${lb.pValue.toFixed(4)}` : "—"}</td></tr>`);
    content.push(`</tbody></table></div>`);

    content.push(`<div class="card"><h3>💡 使用建议</h3>`);
    content.push(`<div class="info-box"><p>• 本模型适用于短期预测（1 ~ 12 期），长期预测请结合领域知识复核。</p><p>• 如数据存在明显季节性，建议改用 SARIMA / Prophet 等季节性模型。</p><p>• 如后续有新观测，建议重新拟合并更新阶数。</p></div></div>`);

    content.push(`</div>`);
    container.innerHTML = content.join("");
  }

  // ============================================================
  // 辅助：逆差分、对齐
  // ============================================================
  function invertFitToOriginal(fittedStationary, origSeries, stationarySeries, d) {
    if (d === 0) return fittedStationary;
    const result = [];
    for (let i = 0; i < fittedStationary.length; i++) {
      const origIdx = i + d;
      if (d === 1 && origIdx - 1 >= 0 && origIdx - 1 < origSeries.length) {
        result.push(origSeries[origIdx - 1] + fittedStationary[i]);
      } else if (d === 2 && origIdx - 1 >= 0 && origIdx - 2 >= 0) {
        const prev1 = origSeries[origIdx - 1];
        const prev2 = origSeries[origIdx - 2];
        const firstDiff = prev1 - prev2;
        result.push(prev1 + (firstDiff + fittedStationary[i]));
      } else {
        result.push(fittedStationary[i]);
      }
    }
    return result;
  }

  function alignFitted(origSeries, fitted, d, pqLag) {
    const offset = Math.max(d, pqLag);
    const actual = [];
    const pred = [];
    for (let i = 0; i < fitted.length && i + offset < origSeries.length; i++) {
      actual.push(origSeries[i + offset]);
      pred.push(fitted[i]);
    }
    return { actual, pred };
  }

  function findCutoff(vals, ci) {
    for (let k = 1; k < vals.length - 3; k++) {
      if (Math.abs(vals[k]) > ci) continue;
      let allSmall = true;
      for (let j = k; j < Math.min(k + 5, vals.length); j++) {
        if (Math.abs(vals[j]) > ci) {
          allSmall = false;
          break;
        }
      }
      if (allSmall && k > 1) return k - 1;
    }
    return -1;
  }

  // ============================================================
  // 图表渲染
  // ============================================================
  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function renderTimeSeriesChart(data, title, canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);
    const labels = data.map((_, i) => i + 1);
    charts[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: title,
            data: data,
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.1)",
            fill: true,
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" }, title: { display: true, text: title } },
        scales: { x: { title: { display: true, text: "时间" } }, y: { title: { display: true, text: "值" } } },
      },
    });
  }

  function renderBarChart(vals, ci, title, canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);
    const labels = vals.map((_, i) => i);
    charts[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: title,
            data: vals,
            backgroundColor: vals.map((v) => (Math.abs(v) > ci ? "#ef4444" : "#4f46e5")),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" }, title: { display: true, text: title } },
        scales: { y: { min: -1, max: 1 } },
      },
    });
  }

  function renderForecastChart(evalData, canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);
    const n = selectedValues.length;
    const labels = Array.from({ length: n }, (_, i) => i + 1);

    const inFilled = new Array(n).fill(null);
    for (let i = 0; i < evalData.inSamplePred.length; i++) {
      const idx = Math.max(0, evalData.trainSize - evalData.inSamplePred.length + i);
      if (idx < n) inFilled[idx] = evalData.inSamplePred[i];
    }
    const testFilled = new Array(n).fill(null);
    for (let i = 0; i < evalData.testPred.length; i++) {
      testFilled[evalData.trainSize + i] = evalData.testPred[i];
    }

    charts[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: "实际值", data: selectedValues, borderColor: "#111827", backgroundColor: "transparent", borderWidth: 2, pointRadius: 0 },
          { label: "样本内拟合", data: inFilled, borderColor: "#4f46e5", backgroundColor: "transparent", borderWidth: 1.5, pointRadius: 0, borderDash: [5, 3] },
          { label: "样本外预测", data: testFilled, borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.15)", borderWidth: 2.5, pointRadius: 3, fill: true },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" }, title: { display: true, text: "实际值 vs 拟合值 vs 预测值" } },
        scales: { x: { title: { display: true, text: "时间期" } }, y: { title: { display: true, text: "值" } } },
      },
    });
  }

  // ============================================================
  // 步骤导航 / UI 状态
  // ============================================================
  function goToStep(step) {
    currentStep = step;
    document.querySelectorAll(".step-panel").forEach((p) => p.classList.remove("active"));
    const panel = document.getElementById(`step-panel-${step}`);
    if (panel) panel.classList.add("active");

    document.querySelectorAll(".step-item").forEach((item) => {
      const s = parseInt(item.dataset.step);
      item.classList.remove("active");
      if (s === step) item.classList.add("active");
    });

    // 进度条
    const pct = Math.round((step / (TOTAL_STEPS - 1)) * 100);
    if (progressFill) progressFill.style.width = `${pct}%`;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markStepDone(step) {
    const item = document.querySelector(`.step-item[data-step="${step}"]`);
    if (item) item.classList.add("done");
  }

  function enableNext(step) {
    // step 1 → 启用 "到 step 2" 的按钮，以此类推
    if (step === 1) {
      document.getElementById("toStep2Btn").disabled = false;
    } else if (step === 2) {
      document.getElementById("toStep3Btn").disabled = false;
    } else if (step === 3) {
      document.getElementById("toStep4Btn").disabled = false;
    } else if (step === 4) {
      document.getElementById("toStep5Btn").disabled = false;
    } else if (step === 5) {
      document.getElementById("toStep6Btn").disabled = false;
    } else if (step === 6) {
      document.getElementById("toStep7Btn").disabled = false;
    } else if (step === 7) {
      document.getElementById("toStep8Btn").disabled = false;
    } else if (step === 8) {
      document.getElementById("toStep9Btn").disabled = false;
    }
  }

  function renderStepError(step, msg) {
    const el = document.getElementById(`step${step}-output`);
    if (!el) return;
    el.innerHTML = `
      <div class="card">
        <div class="danger-box"><h3 style="margin-bottom:10px;">🛑 分析终止</h3><p>${msg}</p></div>
        <div class="info-box" style="margin-top:14px;"><p>建议：</p>
        <ul style="margin-left:20px;line-height:1.8;">
          <li>检查数据质量，补齐缺失值</li>
          <li>若存在明显季节性，使用 SARIMA 模型</li>
          <li>调整 α、d_max、pq_max 等参数后重试</li>
          <li>将样本量扩充至 30 期以上</li>
        </ul></div>
      </div>`;
  }

  function showModal(title, body) {
    const modal = document.getElementById("modal");
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = body;
    modal.classList.add("active");
    const okBtn = document.getElementById("modalConfirm");
    okBtn.onclick = () => modal.classList.remove("active");
  }

  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // ============================================================
  // 导出分析结果：多 sheet Excel 报告
  // ============================================================
  function exportAnalysisReport() {
    try {
      if (!analysisResult || !analysisResult.finalModel) {
        showModal("提示", "<p>尚未完成分析，无数据可导出。</p>");
        return;
      }

      const wb = XLSX.utils.book_new();
      const p = analysisResult.finalP;
      const d = analysisResult.d;
      const q = analysisResult.finalQ;
      const model = analysisResult.finalModel;
      const alpha = parseFloat(document.getElementById("alpha").value) || 0.05;

      // ---------- Sheet 1：分析摘要 ----------
      const summary = [];
      summary.push(["ARIMA 时序分析报告", ""]);
      summary.push(["生成时间", new Date().toLocaleString()]);
      summary.push([""]);
      summary.push(["一、数据概览"]);
      summary.push(["样本量", analysisResult.series.length]);
      if (analysisResult.step1) {
        const s1 = analysisResult.step1;
        summary.push(["均值", +s1.mean.toFixed(4)]);
        summary.push(["标准差", +s1.std.toFixed(4)]);
        summary.push(["最小值", +s1.min.toFixed(4)]);
        summary.push(["最大值", +s1.max.toFixed(4)]);
        summary.push(["缺失值数", s1.missingCount]);
        summary.push(["潜在异常值数", s1.outliers]);
      }
      summary.push([""]);
      summary.push(["二、模型设定"]);
      summary.push(["模型形式", `ARIMA(${p}, ${d}, ${q})`]);
      summary.push(["显著性水平 α", alpha]);
      summary.push(["差分阶数 d", d]);
      summary.push(["AR 阶数 p", p]);
      summary.push(["MA 阶数 q", q]);
      const aicVal = Stats.aic(model.residuals, p + q);
      const bicVal = Stats.bic(model.residuals, p + q);
      summary.push(["AIC", +aicVal.toFixed(4)]);
      summary.push(["BIC", +bicVal.toFixed(4)]);
      summary.push(["残差方差 σ²", +model.sigma2.toFixed(6)]);
      summary.push([""]);
      summary.push(["三、诊断结论"]);
      summary.push(["AR 平稳性", model.arStationary !== false ? "满足" : "不满足"]);
      summary.push(["MA 可逆性", model.maInvertible !== false ? "满足" : "不满足"]);
      if (analysisResult.residual && analysisResult.residual.lb) {
        summary.push(["Ljung-Box p 值", +analysisResult.residual.lb.pValue.toFixed(4)]);
        summary.push(["残差白噪声", analysisResult.residual.lb.pValue > alpha ? "通过" : "未通过"]);
      }
      if (analysisResult.forecast && analysisResult.forecast.outMetrics) {
        const out = analysisResult.forecast.outMetrics;
        summary.push([""]);
        summary.push(["四、预测效果（样本外）"]);
        summary.push(["RMSE", +out.RMSE.toFixed(4)]);
        summary.push(["MAE", +out.MAE.toFixed(4)]);
        if (!isNaN(out.MAPE)) summary.push(["MAPE(%)", +out.MAPE.toFixed(2)]);
      }
      const wsSummary = XLSX.utils.aoa_to_sheet(summary);
      wsSummary["!cols"] = [{ wch: 28 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "分析摘要");

      // ---------- Sheet 2：原始数据 & 平稳序列 ----------
      const rawRows = [["期数", "原始值"]];
      analysisResult.series.forEach((v, i) => rawRows.push([i + 1, v]));
      if (analysisResult.stationarySeries) {
        rawRows[0].push(d === 0 ? "平稳序列" : `${d} 阶差分`);
        analysisResult.stationarySeries.forEach((v, i) => {
          const rowIdx = i + 1;
          if (!rawRows[rowIdx]) rawRows[rowIdx] = [rowIdx];
          rawRows[rowIdx].push(+v.toFixed(6));
        });
      }
      const wsRaw = XLSX.utils.aoa_to_sheet(rawRows);
      wsRaw["!cols"] = [{ wch: 10 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsRaw, "原始与平稳序列");

      // ---------- Sheet 3：ACF / PACF ----------
      const acfVals = Stats.acf(analysisResult.stationarySeries || analysisResult.series, Math.min(30, Math.floor(analysisResult.series.length / 3)));
      const pacfVals = Stats.pacf(analysisResult.stationarySeries || analysisResult.series, Math.min(30, Math.floor(analysisResult.series.length / 3)));
      const corrRows = [["滞后阶", "ACF", "PACF"]];
      for (let k = 0; k < acfVals.length; k++) {
        corrRows.push([k, +(acfVals[k] || 0).toFixed(6), +(pacfVals[k] || 0).toFixed(6)]);
      }
      const wsCorr = XLSX.utils.aoa_to_sheet(corrRows);
      wsCorr["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsCorr, "ACF_PACF");

      // ---------- Sheet 4：阶数网格（如已保存）----------
      if (analysisResult.step5 && analysisResult.step5.grid) {
        const gridRows = [["p", "q", "AIC", "BIC"]];
        analysisResult.step5.grid.forEach((g) => {
          gridRows.push([g.p, g.q, +g.aic.toFixed(4), +g.bic.toFixed(4)]);
        });
        const wsGrid = XLSX.utils.aoa_to_sheet(gridRows);
        wsGrid["!cols"] = [{ wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, wsGrid, "阶数网格");
      }

      // ---------- Sheet 5：模型系数 ----------
      const coefRows = [["参数", "估计值", "标准误", "p 值", "显著性"]];
      const se = model.se || [];
      const pvals = model.pValues || [];
      const arCoefs = model.arCoefs || [];
      const maCoefs = model.maCoefs || [];
      for (let i = 0; i < p; i++) {
        const sig = pvals[i] < alpha ? "显著" : "不显著";
        coefRows.push([`AR(${i + 1})`, +arCoefs[i].toFixed(6), se[i] ? +se[i].toFixed(6) : "—", pvals[i] ? +pvals[i].toFixed(4) : "—", sig]);
      }
      for (let j = 0; j < q; j++) {
        const idx = p + j;
        const sig = pvals[idx] < alpha ? "显著" : "不显著";
        coefRows.push([`MA(${j + 1})`, +maCoefs[j].toFixed(6), se[idx] ? +se[idx].toFixed(6) : "—", pvals[idx] ? +pvals[idx].toFixed(4) : "—", sig]);
      }
      const wsCoef = XLSX.utils.aoa_to_sheet(coefRows);
      wsCoef["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsCoef, "模型系数");

      // ---------- Sheet 6：残差 ----------
      const residRows = [["期数", "残差"]];
      model.residuals.forEach((v, i) => residRows.push([i + 1, +v.toFixed(6)]));
      const wsRes = XLSX.utils.aoa_to_sheet(residRows);
      wsRes["!cols"] = [{ wch: 10 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsRes, "残差序列");

      // ---------- Sheet 7：预测 ----------
      if (analysisResult.forecast) {
        const fc = analysisResult.forecast;
        const forecastRows = [["期数", "类型", "实际值", "预测值"]];
        if (fc.inSampleActual && fc.inSamplePred) {
          const base = fc.trainSize - fc.inSampleActual.length + 1;
          for (let i = 0; i < fc.inSampleActual.length; i++) {
            forecastRows.push([base + i, "样本内", +fc.inSampleActual[i].toFixed(6), +fc.inSamplePred[i].toFixed(6)]);
          }
        }
        if (fc.testActual && fc.testPred) {
          for (let i = 0; i < fc.testActual.length; i++) {
            forecastRows.push([fc.trainSize + i + 1, "样本外", +fc.testActual[i].toFixed(6), +fc.testPred[i].toFixed(6)]);
          }
        }
        // 未来 12 期预测
        let stationaryFull = analysisResult.series.slice();
        for (let i = 0; i < d; i++) stationaryFull = Stats.diff(stationaryFull, 1);
        const futurePred = Stats.forecastARIMA(model, stationaryFull, 12, analysisResult.series.slice(-Math.max(d, 1) - 1), d);
        for (let i = 0; i < futurePred.length; i++) {
          forecastRows.push([analysisResult.series.length + i + 1, "未来预测", "", +futurePred[i].toFixed(6)]);
        }
        const wsFc = XLSX.utils.aoa_to_sheet(forecastRows);
        wsFc["!cols"] = [{ wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsFc, "拟合与预测");
      }

      // ---------- 保存 ----------
      const fileName = `ARIMA分析报告_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showModal("导出成功", `<p>已生成报告：<strong>${fileName}</strong></p><p>共 ${wb.SheetNames.length} 个工作表，包含分析摘要、原始数据、ACF/PACF、模型系数、残差及预测结果。</p>`);
    } catch (err) {
      console.error(err);
      showModal("导出失败", `<p>${err.message}</p>`);
    }
  }
})();
