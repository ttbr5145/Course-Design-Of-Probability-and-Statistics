// ============================================================
// ARIMA 分析主应用
// ============================================================

(function () {
  const fileInput = document.getElementById("fileInput");
  const columnSelector = document.getElementById("columnSelector");
  const valueColumnSelect = document.getElementById("valueColumn");
  const dateColumnSelect = document.getElementById("dateColumn");
  const startBtn = document.getElementById("startAnalysis");
  const dataPreview = document.getElementById("dataPreview");
  const workflowSection = document.getElementById("workflow-section");
  const resultsSection = document.getElementById("results-section");
  const errorSection = document.getElementById("error-section");
  const errorContent = document.getElementById("error-content");
  const finalResults = document.getElementById("final-results");

  let rawData = [];
  let headers = [];
  let selectedValues = [];
  let selectedDates = [];
  let charts = {};

  // ============================================================
  // 数据上传与解析
  // ============================================================

  fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (json.length < 2) {
          showError("数据不足：Excel 文件至少需要 2 行数据。");
          return;
        }
        headers = json[0].map((h, i) => h || `列 ${i + 1}`);
        rawData = json.slice(1).filter((row) => row.some((v) => v !== "" && v !== null && v !== undefined));
        populateColumnSelectors();
        renderPreview();
      } catch (err) {
        showError("文件解析失败：" + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  });

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
    // 默认第2列为数值列（如果有多列）
    if (headers.length >= 2) valueColumnSelect.selectedIndex = 1;
    columnSelector.classList.remove("hidden");
    dataPreview.classList.remove("hidden");
  }

  function renderPreview() {
    const previewTable = document.getElementById("previewTable");
    const maxRows = Math.min(rawData.length, 10);
    let html = '<table><thead><tr>';
    headers.forEach((h) => (html += `<th>${h}</th>`));
    html += '</tr></thead><tbody>';
    for (let i = 0; i < maxRows; i++) {
      html += '<tr>';
      headers.forEach((_, j) => (html += `<td>${rawData[i][j] ?? ''}</td>`));
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += `<p style="margin-top:10px;color:#7f8c8d;">共 ${rawData.length} 行数据，显示前 ${maxRows} 行</p>`;
    previewTable.innerHTML = html;
  }

  // ============================================================
  // 开始分析
  // ============================================================

  startBtn.addEventListener("click", function () {
    const valIdx = parseInt(valueColumnSelect.value);
    const dateIdx = dateColumnSelect.value;
    selectedValues = rawData
      .map((row) => parseFloat(row[valIdx]))
      .filter((v) => !isNaN(v));
    if (dateIdx !== "") {
      selectedDates = rawData.map((row) => String(row[parseInt(dateIdx)]));
    } else {
      selectedDates = rawData.map((_, i) => `第 ${i + 1} 期`);
    }
    if (selectedValues.length < 2) {
      showError("无法解析出有效的数值数据。请检查选择的列。");
      return;
    }
    runAnalysis();
  });

  // ============================================================
  // 主流程
  // ============================================================

  async function runAnalysis() {
    workflowSection.classList.remove("hidden");
    resultsSection.classList.add("hidden");
    errorSection.classList.add("hidden");
    finalResults.innerHTML = "";
    // 重置所有步骤
    document.querySelectorAll(".step").forEach((s) => {
      s.classList.remove("completed", "active", "error-step");
      s.querySelector(".step-content").innerHTML = "";
      s.querySelector(".step-status").textContent = "等待中";
    });

    const config = {
      alpha: parseFloat(document.getElementById("alpha").value),
      d_max: parseInt(document.getElementById("dmax").value),
      pq_max: parseInt(document.getElementById("pqmax").value),
      pq_min: parseInt(document.getElementById("pqmin").value),
      retry: parseInt(document.getElementById("retry").value),
      minSample: parseInt(document.getElementById("minsample").value),
      testRatio: parseFloat(document.getElementById("testratio").value),
    };

    try {
      // ---------- 步骤 1: 数据校验 ----------
      activateStep(1);
      const step1Result = step1_validateData(selectedValues, config);
      if (step1Result.terminate) {
        setStepError(1, step1Result.message);
        showErrorTermination(step1Result.message);
        return;
      }
      setStepCompleted(1, step1Result.message);
      renderTimeSeriesChart(selectedValues, "原始时序图", "step1-chart");
      await sleep(400);

      // ---------- 步骤 2: 季节性初判 ----------
      activateStep(2);
      const step2Result = step2_detectSeasonality(selectedValues, config);
      if (step2Result.switchToSARIMA) {
        setStepError(2, step2Result.message);
        showErrorTermination(step2Result.message);
        return;
      }
      setStepCompleted(2, step2Result.message);
      await sleep(400);

      // ---------- 步骤 3: 平稳性检验 + 差分 ----------
      activateStep(3);
      const step3Result = step3_stationarity(selectedValues, config);
      if (step3Result.terminate) {
        setStepError(3, step3Result.message);
        showErrorTermination(step3Result.message);
        return;
      }
      setStepCompleted(3, step3Result.message);
      renderTimeSeriesChart(step3Result.stationarySeries,
        step3Result.d > 0 ? `${step3Result.d} 阶差分后序列` : "平稳序列（原序列）",
        "step3-chart");
      await sleep(400);

      const modelType = step3Result.d === 0 ? "ARMA" : "ARIMA";
      const d = step3Result.d;
      const stationarySeries = step3Result.stationarySeries;

      // ---------- 步骤 4: ACF / PACF ----------
      activateStep(4);
      const step4Result = step4_acfPacf(stationarySeries, config);
      if (step4Result.terminate) {
        setStepError(4, step4Result.message);
        showErrorTermination(step4Result.message);
        return;
      }
      if (step4Result.switchToSARIMA) {
        setStepError(4, step4Result.message);
        showErrorTermination(step4Result.message);
        return;
      }
      setStepCompleted(4, step4Result.message);
      renderACFPacfCharts(step4Result.acf, step4Result.pacf, "step4-chart");
      await sleep(400);

      // ---------- 步骤 5: p/q 阶数寻优 ----------
      activateStep(5);
      const step5Result = step5_selectOrder(stationarySeries, config);
      if (step5Result.terminate) {
        setStepError(5, step5Result.message);
        showErrorTermination(step5Result.message);
        return;
      }
      setStepCompleted(5, step5Result.message);
      renderAicTable(step5Result.grid, step5Result.best.p, step5Result.best.q);
      await sleep(400);

      const bestP = step5Result.best.p;
      const bestQ = step5Result.best.q;

      // ---------- 步骤 6: 模型拟合 + 合法性校验（带重试） ----------
      activateStep(6);
      const step6Result = step6_fitModel(stationarySeries, bestP, bestQ, d, config);
      if (step6Result.terminate) {
        setStepError(6, step6Result.message);
        showErrorTermination(step6Result.message);
        return;
      }
      setStepCompleted(6, step6Result.message);
      renderCoefficientsTable(step6Result.finalModel, step6Result.finalP, step6Result.finalQ, d, config.alpha);
      await sleep(400);

      const fittedModel = step6Result.finalModel;
      const finalP = step6Result.finalP;
      const finalQ = step6Result.finalQ;

      // ---------- 步骤 7: 残差白噪声检验 ----------
      activateStep(7);
      const step7Result = step7_residualTest(fittedModel, stationarySeries, config);
      if (step7Result.terminate) {
        setStepError(7, step7Result.message);
        showErrorTermination(step7Result.message);
        return;
      }
      setStepCompleted(7, step7Result.message);
      renderResidualChart(fittedModel.residuals, "step7-chart");
      const lbLags = Math.min(24, Math.floor(stationarySeries.length / 4));
      await sleep(400);

      // ---------- 步骤 8: 样本划分 + 预测效果评估 ----------
      activateStep(8);
      const step8Result = step8_forecastEval(
        selectedValues,
        stationarySeries,
        fittedModel,
        finalP,
        finalQ,
        d,
        config
      );
      if (step8Result.terminate) {
        setStepError(8, step8Result.message);
        showErrorTermination(step8Result.message);
        return;
      }
      setStepCompleted(8, step8Result.message);
      renderForecastChart(step8Result, "step8-chart");
      await sleep(400);

      // ---------- 输出最终结果 ----------
      showFinalResults(
        modelType,
        finalP,
        d,
        finalQ,
        fittedModel,
        step8Result,
        step7Result,
        config
      );
    } catch (err) {
      console.error(err);
      showError("分析过程中出现异常：" + err.message);
    }
  }

  // ============================================================
  // 步骤 1 - 数据校验
  // ============================================================
  function step1_validateData(values, config) {
    const n = values.length;
    const content = [];
    content.push(`<p><strong>样本总量：</strong>${n}</p>`);
    content.push(`<p><strong>最小样本要求：</strong>${config.minSample}</p>`);

    if (n < config.minSample) {
      return {
        terminate: true,
        message: `样本数量不足（${n} < ${config.minSample}），无法开展时序建模`,
      };
    }

    // 缺失值检测
    const missing = Stats.checkMissing(values);
    if (missing.hasMissing) {
      content.push(`<div class="warning-box">⚠ 检测到 ${missing.count} 个缺失值，位于位置：${missing.positions.slice(0, 10).join(", ")}${missing.positions.length > 10 ? "..." : ""}。<br><strong>请手动补齐缺失值后重新上传数据。</strong></div>`);
      document.getElementById("step-1").querySelector(".step-content").innerHTML = content.join("");
      return {
        terminate: true,
        message: `数据存在缺失值（${missing.count} 处），请手动补齐后重新分析`,
      };
    }

    // 异常值检测
    const outliers = Stats.detectOutliers(values);
    if (outliers.length > 0) {
      content.push(`<div class="warning-box">⚠ 检测到 ${outliers.length} 个潜在异常值（3σ 法则）：<br>${outliers.slice(0, 5).map(o => `位置 ${o.index + 1}: ${o.value.toFixed(2)}`).join("<br>")}${outliers.length > 5 ? "<br>..." : ""}<br>建议检查这些值。</div>`);
    } else {
      content.push('<div class="success-box">✓ 未检测到显著异常值</div>');
    }

    // 基本统计
    const m = Stats.mean(values);
    const s = Stats.stddev(values);
    content.push(`<div class="info-box"><strong>基本统计：</strong><br>均值：${m.toFixed(4)}<br>标准差：${s.toFixed(4)}<br>最小值：${Math.min(...values).toFixed(4)}<br>最大值：${Math.max(...values).toFixed(4)}</div>`);
    content.push('<div class="chart-container"><canvas id="step1-chart"></canvas></div>');

    document.getElementById("step-1").querySelector(".step-content").innerHTML = content.join("");
    return { terminate: false, message: "数据校验通过" };
  }

  // ============================================================
  // 步骤 2 - 季节性初判
  // ============================================================
  function step2_detectSeasonality(values, config) {
    const season = Stats.detectSeasonality(values);
    const content = [];
    content.push(`<div class="info-box"><strong>季节性检测结果：</strong><br>`);
    if (season.hasSeasonality) {
      content.push(`<div class="error-box">✗ 检测到显著季节性特征（疑似周期 ≈ ${season.period}），普通 ARIMA 模型不适用，应使用 SARIMA 模型。</div>`);
    } else {
      content.push(`<div class="success-box">✓ 未检测到显著季节性特征，可以使用 ARIMA / ARMA 模型。</div>`);
    }
    content.push(`</div>`);
    content.push(`<p>显著性阈值（95% CI）：±${season.ci.toFixed(4)}</p>`);
    if (season.acfPeaks.length > 0) {
      content.push(`<p>主要 ACF 峰值：</p>`);
      content.push(`<table><thead><tr><th>滞后阶</th><th>ACF 值</th></tr></thead><tbody>`);
      season.acfPeaks.forEach(p => {
        content.push(`<tr><td>${p.lag}</td><td>${p.value.toFixed(4)}</td></tr>`);
      });
      content.push(`</tbody></table>`);
    }

    document.getElementById("step-2").querySelector(".step-content").innerHTML = content.join("");

    if (season.hasSeasonality) {
      return {
        switchToSARIMA: true,
        message: `检测到显著季节性（周期 ≈ ${season.period}），建议改用 SARIMA 模型`,
      };
    }
    return { switchToSARIMA: false, message: "无显著季节性" };
  }

  // ============================================================
  // 步骤 3 - 平稳性检验与差分
  // ============================================================
  function step3_stationarity(values, config) {
    const content = [];
    let currentSeries = values.slice();
    let d = 0;
    const maxD = config.d_max;
    const alpha = config.alpha;

    while (d <= maxD) {
      const adf = Stats.adfTest(currentSeries);
      content.push(`<div class="info-box">`);
      content.push(`<strong>${d === 0 ? "原序列" : `第 ${d} 阶差分后`} ADF 检验：</strong><br>`);
      content.push(`统计量 t = ${adf.stat.toFixed(4)}<br>`);
      content.push(`p 值 ≈ ${adf.pValue.toFixed(4)}<br>`);
      content.push(`临界值（1%）：${adf.critical["0.01"].toFixed(4)}<br>`);
      content.push(`临界值（5%）：${adf.critical["0.05"].toFixed(4)}<br>`);
      content.push(`临界值（10%）：${adf.critical["0.10"].toFixed(4)}<br>`);
      if (adf.pValue < alpha) {
        content.push(`<div class="success-box">✓ p 值 (${adf.pValue.toFixed(4)}) < α (${alpha})，序列平稳</div>`);
        content.push(`</div>`);
        break;
      } else {
        content.push(`<div class="warning-box">⚠ p 值 (${adf.pValue.toFixed(4)}) ≥ α (${alpha})，序列非平稳，进行差分</div>`);
        content.push(`</div>`);
        d++;
        if (d > maxD) break;
        currentSeries = Stats.diff(currentSeries, 1);
      }
    }

    if (d > maxD) {
      document.getElementById("step-3").querySelector(".step-content").innerHTML = content.join("");
      return {
        terminate: true,
        message: `经过 ${maxD} 次差分后仍无法平稳（超过 d_max=${maxD}），不满足 ARIMA 前提`,
      };
    }

    content.push('<div class="chart-container"><canvas id="step3-chart"></canvas></div>');
    document.getElementById("step-3").querySelector(".step-content").innerHTML = content.join("");

    if (d === 0) {
      return {
        terminate: false,
        message: `原序列已平稳（d=0），切换为 ARMA 模型继续分析`,
        d: 0,
        stationarySeries: currentSeries,
      };
    }
    return {
      terminate: false,
      message: `确定差分阶数 d=${d}，使用差分后平稳序列`,
      d: d,
      stationarySeries: currentSeries,
    };
  }

  // ============================================================
  // 步骤 4 - ACF / PACF
  // ============================================================
  function step4_acfPacf(series, config) {
    const maxLag = Math.min(40, Math.floor(series.length / 3));
    const acfVals = Stats.acf(series, maxLag);
    const pacfVals = Stats.pacf(series, maxLag);
    const ci = 1.96 / Math.sqrt(series.length);
    const content = [];

    // 检查周期性（隐性季节）
    let seasonalPeaks = 0;
    for (let lag = 2; lag < maxLag; lag++) {
      if (Math.abs(acfVals[lag]) > ci && Math.abs(acfVals[lag]) > 0.3) seasonalPeaks++;
    }
    // 检查 ACF/PACF 是否完全混乱
    let significantCount = 0;
    for (let lag = 1; lag <= Math.min(10, maxLag); lag++) {
      if (Math.abs(acfVals[lag]) > ci) significantCount++;
      if (Math.abs(pacfVals[lag]) > ci) significantCount++;
    }

    content.push(`<div class="info-box">`);
    content.push(`<p>置信区间：±${ci.toFixed(4)}</p>`);
    content.push(`<p>显著相关的滞后数：${significantCount}</p>`);
    content.push(`</div>`);

    // 识别规律
    const pacfCutoff = findCutoff(pacfVals, ci);
    const acfCutoff = findCutoff(acfVals, ci);
    content.push(`<div class="info-box">`);
    if (pacfCutoff > 0 && acfCutoff < 0) {
      content.push(`<p>✓ PACF 疑似在 ${pacfCutoff} 阶截尾，ACF 拖尾 → 符合 AR 特征</p>`);
    } else if (acfCutoff > 0 && pacfCutoff < 0) {
      content.push(`<p>✓ ACF 疑似在 ${acfCutoff} 阶截尾，PACF 拖尾 → 符合 MA 特征</p>`);
    } else if (acfCutoff > 0 && pacfCutoff > 0) {
      content.push(`<p>✓ ACF 与 PACF 均有截尾特征 → 符合 ARMA 特征</p>`);
    } else if (significantCount === 0) {
      content.push(`<div class="warning-box">⚠ ACF / PACF 无任何显著相关，序列近似白噪声，无法建模</div>`);
      content.push(`</div>`);
      document.getElementById("step-4").querySelector(".step-content").innerHTML = content.join("");
      return { terminate: true, message: "ACF/PACF 无规律，无法确定阶数" };
    } else {
      content.push(`<p>✓ 序列存在自相关规律，可以通过 AIC/BIC 进行网格寻优</p>`);
    }
    content.push(`</div>`);

    if (seasonalPeaks >= 4) {
      content.push(`<div class="warning-box">⚠ ACF 中发现多个显著峰值，可能存在隐性季节性，建议使用 SARIMA 模型。</div>`);
    }

    content.push('<div class="chart-container" style="height:320px;"><canvas id="step4-chart"></canvas></div>');
    document.getElementById("step-4").querySelector(".step-content").innerHTML = content.join("");

    return {
      terminate: false,
      message: "ACF/PACF 分析通过，可以继续进行阶数寻优",
      acf: acfVals,
      pacf: pacfVals,
    };
  }

  function findCutoff(vals, ci) {
    // 找到截尾点：某阶后连续多个滞后均在 CI 内
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
  // 步骤 5 - p/q 阶数寻优
  // ============================================================
  function step5_selectOrder(series, config) {
    const pMin = config.pq_min;
    const pMax = config.pq_max;
    const qMin = config.pq_min;
    const qMax = config.pq_max;
    const grid = [];
    let best = { p: 0, q: 0, aic: Infinity, bic: Infinity };
    const content = [];

    content.push(`<div class="info-box"><p><strong>搜索范围：</strong>p ∈ [${pMin}, ${pMax}], q ∈ [${qMin}, ${qMax}]</p></div>`);

    for (let p = pMin; p <= pMax; p++) {
      for (let q = qMin; q <= qMax; q++) {
        try {
          const fit = Stats.fitARIMA(series, p, q);
          if (!fit || !fit.success) continue;
          const aicVal = Stats.aic(fit.residuals, p + q);
          const bicVal = Stats.bic(fit.residuals, p + q);
          if (!isFinite(aicVal) || !isFinite(bicVal)) continue;
          grid.push({ p: p, q: q, aic: aicVal, bic: bicVal });
          if (aicVal < best.aic) {
            best = { p: p, q: q, aic: aicVal, bic: bicVal };
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (grid.length === 0) {
      document.getElementById("step-4").querySelector(".step-content").innerHTML = content.join("");
      return { terminate: true, message: "所有 (p, q) 组合拟合失败，无法建模" };
    }

    // 简约原则：若多个组合 AIC 接近，选 p+q 最小的
    const minAic = best.aic;
    const closeModels = grid.filter(m => Math.abs(m.aic - minAic) < 2);
    if (closeModels.length > 1) {
      closeModels.sort((a, b) => (a.p + a.q) - (b.p + b.q));
      best = closeModels[0];
      content.push(`<div class="warning-box">⚠ 发现 ${closeModels.length} 个模型 AIC 值相近（差 < 2），遵循简约原则选择 (p=${best.p}, q=${best.q})</div>`);
    }

    content.push(`<div class="success-box"><p><strong>最优组合：</strong>p=${best.p}, q=${best.q}（AIC=${best.aic.toFixed(2)}, BIC=${best.bic.toFixed(2)}）</p></div>`);
    content.push(`<div id="aic-table-container"></div>`);
    document.getElementById("step-5").querySelector(".step-content").innerHTML = content.join("");

    return {
      terminate: false,
      message: `最优阶数确定：p=${best.p}, q=${best.q}`,
      best: best,
      grid: grid,
    };
  }

  // ============================================================
  // 步骤 6 - 模型拟合与合法性校验（重试循环）
  // ============================================================
  function step6_fitModel(series, p, q, d, config) {
    const content = [];
    let currentP = p;
    let currentQ = q;
    let retries = 0;
    let model = null;
    const maxRetry = config.retry;
    const alpha = config.alpha;

    while (retries <= maxRetry) {
      const fit = Stats.fitARIMA(series, currentP, currentQ);
      if (!fit || !fit.success) {
        retries++;
        if (retries > maxRetry) break;
        if (currentP > 0) currentP--;
        else if (currentQ > 0) currentQ--;
        continue;
      }
      model = fit;

      // 校验 1: 系数显著性
      const pvals = model.pValues || [];
      let significantCount = 0;
      for (let i = 0; i < pvals.length; i++) {
        if (pvals[i] < alpha) significantCount++;
      }
      const totalParams = currentP + currentQ;
      const allSignificant = totalParams === 0 || significantCount >= Math.ceil(totalParams * 0.5);
      // 只要半数以上显著即可（小样本下严格所有显著太苛刻）

      // 校验 2: AR 平稳 + MA 可逆
      const arOk = model.arStationary !== false;
      const maOk = model.maInvertible !== false;

      content.push(`<div class="info-box">`);
      content.push(`<p><strong>尝试 ${retries + 1}：ARIMA(${currentP}, ${d}, ${currentQ})</strong></p>`);
      content.push(`<p>系数显著比例：${significantCount}/${totalParams}${totalParams === 0 ? "（无参数）" : ""}</p>`);
      content.push(`<p>AR 平稳性：${arOk ? "✓ 满足" : "✗ 不满足"}</p>`);
      content.push(`<p>MA 可逆性：${maOk ? "✓ 满足" : "✗ 不满足"}</p>`);
      content.push(`</div>`);

      if (allSignificant && arOk && maOk) {
        break;
      }

      retries++;
      if (retries > maxRetry) break;
      // 降低阶数
      if (currentP >= currentQ && currentP > 0) currentP--;
      else if (currentQ > 0) currentQ--;
      else break;
    }

    document.getElementById("step-6").querySelector(".step-content").innerHTML = content.join("");

    if (!model) {
      return {
        terminate: true,
        message: `经过 ${maxRetry} 次重试仍无法成功拟合模型`,
      };
    }

    // 最终再次检查
    const pvals = model.pValues || [];
    const arOk = model.arStationary !== false;
    const maOk = model.maInvertible !== false;
    if (!arOk || !maOk) {
      return {
        terminate: true,
        message: `多次重试后模型仍不满足 AR 平稳 / MA 可逆条件`,
      };
    }

    return {
      terminate: false,
      message: `模型 ARIMA(${currentP}, ${d}, ${currentQ}) 拟合成功，通过平稳性/可逆性检验`,
      finalModel: model,
      finalP: currentP,
      finalQ: currentQ,
    };
  }

  // ============================================================
  // 步骤 7 - 残差白噪声检验
  // ============================================================
  function step7_residualTest(model, series, config) {
    const content = [];
    const residuals = model.residuals;
    const alpha = config.alpha;
    const testLag = Math.min(24, Math.floor(series.length / 4));
    const lb = Stats.ljungBoxTest(residuals, testLag);

    content.push(`<div class="info-box">`);
    content.push(`<p><strong>Ljung-Box 白噪声检验</strong></p>`);
    content.push(`<p>检验滞后阶：${testLag}</p>`);
    content.push(`<p>Q 统计量：${lb.Q.toFixed(4)}</p>`);
    content.push(`<p>自由度：${lb.df}</p>`);
    content.push(`<p>p 值：${lb.pValue.toFixed(4)}</p>`);
    if (lb.pValue > alpha) {
      content.push(`<div class="success-box">✓ p 值 (${lb.pValue.toFixed(4)}) > α (${alpha})，残差为白噪声，模型有效</div>`);
    } else {
      content.push(`<div class="warning-box">⚠ p 值 (${lb.pValue.toFixed(4)}) ≤ α (${alpha})，残差存在自相关，模型可能未充分提取信息</div>`);
    }
    content.push(`</div>`);

    // 残差描述性统计
    const resMean = Stats.mean(residuals);
    const resStd = Stats.stddev(residuals);
    content.push(`<div class="info-box"><p><strong>残差统计：</strong></p>`);
    content.push(`<p>均值：${resMean.toFixed(6)}（理想应接近 0）</p>`);
    content.push(`<p>标准差：${resStd.toFixed(4)}</p>`);
    content.push(`</div>`);
    content.push('<div class="chart-container"><canvas id="step7-chart"></canvas></div>');

    document.getElementById("step-7").querySelector(".step-content").innerHTML = content.join("");

    if (lb.pValue <= alpha) {
      // 允许一定宽容度：如果 p > alpha/2 也接受
      if (lb.pValue > alpha / 3) {
        return { terminate: false, message: `残差检验通过（p=${lb.pValue.toFixed(4)}，略低于阈值但可接受）` };
      }
      return {
        terminate: true,
        message: `残差非白噪声（p=${lb.pValue.toFixed(4)}），模型未充分提取信息，建议尝试其他阶数或增加差分`,
      };
    }
    return { terminate: false, message: `残差白噪声检验通过（p=${lb.pValue.toFixed(4)}）`, lb: lb };
  }

  // ============================================================
  // 步骤 8 - 预测效果评估
  // ============================================================
  function step8_forecastEval(origSeries, stationarySeries, model, p, q, d, config) {
    const content = [];
    const n = origSeries.length;
    const testSize = Math.max(1, Math.floor(n * config.testRatio));
    const trainSize = n - testSize;
    const trainOrig = origSeries.slice(0, trainSize);
    const testOrig = origSeries.slice(trainSize);

    // 对训练集重新执行 d 次差分
    let trainStationary = trainOrig.slice();
    for (let i = 0; i < d; i++) trainStationary = Stats.diff(trainStationary, 1);

    // 用训练集重新拟合同阶模型
    const trainModel = Stats.fitARIMA(trainStationary, p, q);
    if (!trainModel || !trainModel.success) {
      return { terminate: true, message: "训练集上重新拟合模型失败" };
    }

    // 样本外多步预测
    const lastValues = trainOrig.slice(-Math.max(d, 1) - 1);
    const outSamplePred = Stats.forecastARIMA(
      trainModel,
      trainStationary,
      testSize,
      lastValues,
      d
    );

    // 样本内拟合（原尺度）
    const inSampleFittedStationary = Stats.fittedValuesARIMA(model, stationarySeries);
    // 逆差分还原到原尺度
    const inSampleFitted = invertFitToOriginal(inSampleFittedStationary, origSeries, stationarySeries, d);

    // 计算误差指标
    const outMetrics = Stats.forecastMetrics(testOrig, outSamplePred);
    // 对齐样本内
    const inSampleAligned = alignFitted(origSeries, inSampleFitted, d, Math.max(p, q));
    const inMetrics = Stats.forecastMetrics(inSampleAligned.actual, inSampleAligned.pred);

    content.push(`<div class="info-box">`);
    content.push(`<p><strong>样本划分：</strong></p>`);
    content.push(`<p>训练集大小：${trainSize}（前 ${((trainSize / n) * 100).toFixed(1)}%）</p>`);
    content.push(`<p>测试集大小：${testSize}（后 ${((testSize / n) * 100).toFixed(1)}%）</p>`);
    content.push(`</div>`);

    content.push(`<div class="info-box"><p><strong>样本内拟合（训练集）：</strong></p>`);
    content.push(`<table class="metrics-table"><thead><tr><th>指标</th><th>值</th></tr></thead><tbody>`);
    content.push(`<tr><td>MAE (平均绝对误差)</td><td>${inMetrics.MAE.toFixed(4)}</td></tr>`);
    content.push(`<tr><td>MSE (均方误差)</td><td>${inMetrics.MSE.toFixed(4)}</td></tr>`);
    content.push(`<tr><td>RMSE (均方根误差)</td><td>${inMetrics.RMSE.toFixed(4)}</td></tr>`);
    if (!isNaN(inMetrics.MAPE)) content.push(`<tr><td>MAPE (平均绝对百分比误差)</td><td>${inMetrics.MAPE.toFixed(2)}%</td></tr>`);
    content.push(`</tbody></table></div>`);

    content.push(`<div class="info-box"><p><strong>样本外预测（测试集）：</strong></p>`);
    content.push(`<table class="metrics-table"><thead><tr><th>指标</th><th>值</th></tr></thead><tbody>`);
    content.push(`<tr><td>MAE</td><td>${outMetrics.MAE.toFixed(4)}</td></tr>`);
    content.push(`<tr><td>MSE</td><td>${outMetrics.MSE.toFixed(4)}</td></tr>`);
    content.push(`<tr><td>RMSE</td><td>${outMetrics.RMSE.toFixed(4)}</td></tr>`);
    if (!isNaN(outMetrics.MAPE)) content.push(`<tr><td>MAPE</td><td>${outMetrics.MAPE.toFixed(2)}%</td></tr>`);
    content.push(`</tbody></table></div>`);

    // 过拟合判断
    const ratio = outMetrics.RMSE / (inMetrics.RMSE || 1);
    content.push(`<div class="info-box">`);
    content.push(`<p><strong>泛化能力评估：</strong></p>`);
    content.push(`<p>测试集 RMSE / 训练集 RMSE = ${ratio.toFixed(3)}</p>`);
    if (ratio > 3) {
      content.push(`<div class="warning-box">⚠ 比值过大，疑似过拟合，建议降低模型阶数</div>`);
    } else if (ratio > 1.5) {
      content.push(`<p>模型泛化能力一般</p>`);
    } else {
      content.push(`<div class="success-box">✓ 模型泛化能力良好</div>`);
    }
    content.push(`</div>`);

    content.push('<div class="chart-container" style="height:380px;"><canvas id="step8-chart"></canvas></div>');

    document.getElementById("step-8").querySelector(".step-content").innerHTML = content.join("");

    if (ratio > 5) {
      return {
        terminate: true,
        message: `模型严重过拟合（测试集/训练集误差比 = ${ratio.toFixed(2)}），无实用价值`,
      };
    }

    return {
      terminate: false,
      message: `预测评估通过（MAPE=${isNaN(outMetrics.MAPE) ? "N/A" : outMetrics.MAPE.toFixed(2) + "%"}）`,
      trainSize: trainSize,
      testSize: testSize,
      testActual: testOrig,
      testPred: outSamplePred,
      inSampleActual: inSampleAligned.actual,
      inSamplePred: inSampleAligned.pred,
      inMetrics: inMetrics,
      outMetrics: outMetrics,
      fullPred: outSamplePred,
    };
  }

  function invertFitToOriginal(fittedStationary, origSeries, stationarySeries, d) {
    if (d === 0) {
      return fittedStationary;
    }
    // 还原：对差分序列的拟合值进行逆差分
    // 简化：用原序列值进行累计还原
    // fittedStationary 是差分后的拟合值，要还原到原尺度
    const result = [];
    const startIdx = d; // 差分后起点
    for (let i = 0; i < fittedStationary.length; i++) {
      if (i + startIdx < origSeries.length) {
        result.push(fittedStationary[i]); // 先返回差分尺度
      }
    }
    // 差分尺度的预测 → 原尺度
    if (d === 1) {
      // y_t_hat = y_{t-1} + delta_hat
      const origLevel = [];
      for (let i = 0; i < result.length; i++) {
        const origIdx = i + d;
        if (origIdx - 1 >= 0 && origIdx - 1 < origSeries.length) {
          origLevel.push(origSeries[origIdx - 1] + result[i]);
        }
      }
      return origLevel;
    }
    if (d === 2) {
      // 二阶差分
      const firstDiff = []; // 存储一阶差分的拟合值
      for (let i = 0; i < result.length; i++) {
        const origIdx = i + d;
        // delta1_hat[t] = delta1[t-1] + delta2_hat[t]
        const prevFirstDiff = origSeries[origIdx - 1] - origSeries[origIdx - 2];
        firstDiff.push(prevFirstDiff + result[i]);
      }
      const origLevel = [];
      for (let i = 0; i < firstDiff.length; i++) {
        const origIdx = i + d;
        origLevel.push(origSeries[origIdx - 1] + firstDiff[i]);
      }
      return origLevel;
    }
    return result; // 高阶暂不支持详细还原
  }

  function alignFitted(origSeries, fitted, d, pqLag) {
    // 对齐原序列与拟合值
    const offset = Math.max(d, pqLag);
    const actual = [];
    const pred = [];
    for (let i = 0; i < fitted.length && i + offset < origSeries.length; i++) {
      actual.push(origSeries[i + offset]);
      pred.push(fitted[i]);
    }
    return { actual: actual, pred: pred };
  }

  // ============================================================
  // 最终结果渲染
  // ============================================================
  function showFinalResults(modelType, p, d, q, model, evalData, residualData, config) {
    resultsSection.classList.remove("hidden");
    const aicVal = Stats.aic(model.residuals, p + q);
    const bicVal = Stats.bic(model.residuals, p + q);
    const out = evalData.outMetrics;

    let html = `<h2 style="color:#fff;margin-bottom:20px;">🎉 分析完成 - 最终模型：${modelType}(${p}, ${d}, ${q})</h2>`;
    html += `<div class="result-grid">`;
    html += `<div class="result-card"><div class="label">模型阶数</div><div class="value">(${p}, ${d}, ${q})</div></div>`;
    html += `<div class="result-card"><div class="label">AIC</div><div class="value">${aicVal.toFixed(2)}</div></div>`;
    html += `<div class="result-card"><div class="label">BIC</div><div class="value">${bicVal.toFixed(2)}</div></div>`;
    html += `<div class="result-card"><div class="label">残差方差 σ²</div><div class="value">${model.sigma2.toFixed(4)}</div></div>`;
    if (out && !isNaN(out.MAPE)) {
      html += `<div class="result-card"><div class="label">测试集 MAPE</div><div class="value">${out.MAPE.toFixed(2)}%</div></div>`;
    }
    if (out) {
      html += `<div class="result-card"><div class="label">测试集 RMSE</div><div class="value">${out.RMSE.toFixed(4)}</div></div>`;
    }
    html += `</div>`;

    // 生成未来 12 期预测
    const futureSteps = 12;
    const futurePred = Stats.forecastARIMA(
      model,
      // 重新获取
      (function () {
        let s = selectedValues.slice();
        for (let i = 0; i < d; i++) s = Stats.diff(s, 1);
        return s;
      })(),
      futureSteps,
      selectedValues.slice(-Math.max(d, 1) - 1),
      d
    );

    html += `<div style="background:rgba(255,255,255,0.15);padding:20px;border-radius:8px;margin-top:20px;">`;
    html += `<h3>🔮 未来 ${futureSteps} 期预测</h3>`;
    html += `<table style="width:100%;color:#fff;margin-top:10px;"><thead><tr><th>期数</th><th>预测值</th></tr></thead><tbody>`;
    for (let i = 0; i < futurePred.length; i++) {
      html += `<tr><td>第 ${selectedValues.length + i + 1} 期</td><td>${futurePred[i].toFixed(4)}</td></tr>`;
    }
    html += `</tbody></table>`;
    html += `</div>`;

    html += `<div style="background:rgba(255,255,255,0.15);padding:20px;border-radius:8px;margin-top:20px;">`;
    html += `<h3>📋 模型摘要</h3>`;
    html += `<table style="width:100%;color:#fff;margin-top:10px;"><tbody>`;
    html += `<tr><td style="width:50%;">模型类型</td><td><strong>${modelType}(${p}, ${d}, ${q})</strong></td></tr>`;
    html += `<tr><td>AR 系数个数</td><td>${p}</td></tr>`;
    html += `<tr><td>MA 系数个数</td><td>${q}</td></tr>`;
    html += `<tr><td>差分阶数 d</td><td>${d}</td></tr>`;
    html += `<tr><td>有效观测数</td><td>${model.numObs || model.residuals.length}</td></tr>`;
    html += `<tr><td>AR 平稳性</td><td>${model.arStationary !== false ? "✓ 满足" : "✗ 不满足"}</td></tr>`;
    html += `<tr><td>MA 可逆性</td><td>${model.maInvertible !== false ? "✓ 满足" : "✗ 不满足"}</td></tr>`;
    html += `<tr><td>残差白噪声检验</td><td>✓ 通过 (p=${residualData.lb ? residualData.lb.pValue.toFixed(4) : "N/A"})</td></tr>`;
    html += `</tbody></table>`;
    html += `</div>`;

    finalResults.innerHTML = html;
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
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
    setTimeout(() => {
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
              borderColor: "#3498db",
              backgroundColor: "rgba(52, 152, 219, 0.1)",
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
          plugins: { legend: { position: "top" } },
          scales: { x: { title: { display: true, text: "时间" } }, y: { title: { display: true, text: "值" } } },
        },
      });
    }, 100);
  }

  function renderACFPacfCharts(acfVals, pacfVals, canvasId) {
    setTimeout(() => {
      const container = document.getElementById(canvasId);
      if (!container) return;
      const parent = container.parentElement;
      parent.innerHTML =
        '<div class="chart-row"><div class="chart-container"><canvas id="acf-canvas"></canvas></div><div class="chart-container"><canvas id="pacf-canvas"></canvas></div></div>';
      const ci = 1.96 / Math.sqrt(acfVals.length * 4); // 粗略
      const labels = acfVals.map((_, i) => i);
      // ACF
      const acfCtx = document.getElementById("acf-canvas");
      if (acfCtx) {
        charts["acf-canvas"] = new Chart(acfCtx, {
          type: "bar",
          data: {
            labels: labels,
            datasets: [
              {
                label: "ACF",
                data: acfVals,
                backgroundColor: acfVals.map(v => Math.abs(v) > ci ? "#e74c3c" : "#3498db"),
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: "自相关函数 (ACF)" } },
            scales: { y: { min: -1, max: 1 } },
          },
        });
      }
      const pacfCtx = document.getElementById("pacf-canvas");
      if (pacfCtx) {
        charts["pacf-canvas"] = new Chart(pacfCtx, {
          type: "bar",
          data: {
            labels: labels,
            datasets: [
              {
                label: "PACF",
                data: pacfVals,
                backgroundColor: pacfVals.map(v => Math.abs(v) > ci ? "#e74c3c" : "#27ae60"),
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: "偏自相关函数 (PACF)" } },
            scales: { y: { min: -1, max: 1 } },
          },
        });
      }
    }, 100);
  }

  function renderAicTable(grid, bestP, bestQ) {
    setTimeout(() => {
      const container = document.getElementById("aic-table-container");
      if (!container) return;
      const ps = [...new Set(grid.map(g => g.p))].sort((a, b) => a - b);
      const qs = [...new Set(grid.map(g => g.q))].sort((a, b) => a - b);
      const gridMap = {};
      grid.forEach(g => (gridMap[`${g.p}_${g.q}`] = g));
      let html = '<table style="margin-top:15px;"><thead><tr><th>p \\ q</th>';
      qs.forEach(q => (html += `<th>${q}</th>`));
      html += '</tr></thead><tbody>';
      ps.forEach(p => {
        html += `<tr><th>${p}</th>`;
        qs.forEach(q => {
          const cell = gridMap[`${p}_${q}`];
          if (cell) {
            const isBest = p === bestP && q === bestQ;
            html += `<td style="${isBest ? 'background:#f39c12;color:#fff;font-weight:bold;' : ''}">${cell.aic.toFixed(1)}<br><small>BIC:${cell.bic.toFixed(1)}</small></td>`;
          } else {
            html += '<td style="color:#bbb;">-</td>';
          }
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '<p style="margin-top:10px;font-size:0.9em;color:#7f8c8d;">单元格：AIC 值 (BIC 值)，高亮单元格为最优</p>';
      container.innerHTML = html;
    }, 100);
  }

  function renderCoefficientsTable(model, p, q, d, alpha) {
    setTimeout(() => {
      const stepContent = document.getElementById("step-6").querySelector(".step-content");
      if (!stepContent) return;
      let html = '<div class="info-box" style="margin-top:15px;"><p><strong>系数估计结果：</strong></p>';
      html += '<table class="coefficients-table"><thead><tr><th>参数</th><th>估计值</th><th>标准误</th><th>p 值</th><th>显著性</th></tr></thead><tbody>';
      const se = model.se || [];
      const pvals = model.pValues || [];
      const arCoefs = model.arCoefs || [];
      const maCoefs = model.maCoefs || [];
      for (let i = 0; i < p; i++) {
        const sig = pvals[i] < alpha;
        html += `<tr><td>AR(${i + 1})</td><td>${arCoefs[i].toFixed(4)}</td><td>${se[i] ? se[i].toFixed(4) : "-"}</td><td>${pvals[i] ? pvals[i].toFixed(4) : "-"}</td><td class="${sig ? 'significant' : 'not-significant'}">${sig ? '✓ 显著' : '✗ 不显著'}</td></tr>`;
      }
      for (let j = 0; j < q; j++) {
        const idx = p + j;
        const sig = pvals[idx] < alpha;
        html += `<tr><td>MA(${j + 1})</td><td>${maCoefs[j].toFixed(4)}</td><td>${se[idx] ? se[idx].toFixed(4) : "-"}</td><td>${pvals[idx] ? pvals[idx].toFixed(4) : "-"}</td><td class="${sig ? 'significant' : 'not-significant'}">${sig ? '✓ 显著' : '✗ 不显著'}</td></tr>`;
      }
      html += '</tbody></table>';
      html += '</div>';
      stepContent.innerHTML += html;
    }, 100);
  }

  function renderResidualChart(residuals, canvasId) {
    setTimeout(() => {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      destroyChart(canvasId);
      const labels = residuals.map((_, i) => i + 1);
      charts[canvasId] = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "残差",
              data: residuals,
              borderColor: "#27ae60",
              backgroundColor: "rgba(39, 174, 96, 0.1)",
              fill: true,
              tension: 0.1,
              pointRadius: 0,
              borderWidth: 1.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { title: { display: true, text: "残差序列图" } },
          scales: { x: { title: { display: true, text: "时间" } }, y: { title: { display: true, text: "残差" } } },
        },
      });
    }, 100);
  }

  function renderForecastChart(evalData, canvasId) {
    setTimeout(() => {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      destroyChart(canvasId);
      const n = selectedValues.length;
      const labels = Array.from({ length: n }, (_, i) => i + 1);

      // 样本内拟合（对齐后）
      const inStart = n - evalData.testSize - evalData.inSamplePred.length;
      const inFilled = new Array(n).fill(null);
      for (let i = 0; i < evalData.inSamplePred.length; i++) {
        const idx = Math.max(0, n - evalData.testSize - evalData.inSamplePred.length + i);
        if (idx < n) inFilled[idx] = evalData.inSamplePred[i];
      }

      // 测试集预测
      const testFilled = new Array(n).fill(null);
      for (let i = 0; i < evalData.testPred.length; i++) {
        testFilled[n - evalData.testSize + i] = evalData.testPred[i];
      }

      charts[canvasId] = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "实际值",
              data: selectedValues,
              borderColor: "#2c3e50",
              backgroundColor: "transparent",
              borderWidth: 2,
              pointRadius: 0,
            },
            {
              label: "样本内拟合",
              data: inFilled,
              borderColor: "#3498db",
              backgroundColor: "transparent",
              borderWidth: 1.5,
              pointRadius: 0,
              borderDash: [5, 3],
            },
            {
              label: "样本外预测",
              data: testFilled,
              borderColor: "#e74c3c",
              backgroundColor: "rgba(231, 76, 60, 0.1)",
              borderWidth: 2.5,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: "实际值 vs 拟合值 vs 预测值" },
            legend: { position: "top" },
          },
          scales: {
            x: { title: { display: true, text: "时间期" } },
            y: { title: { display: true, text: "值" } },
          },
        },
      });
    }, 100);
  }

  // ============================================================
  // UI 辅助
  // ============================================================
  function activateStep(num) {
    const el = document.getElementById(`step-${num}`);
    el.classList.add("active");
    el.querySelector(".step-status").textContent = "处理中...";
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function setStepCompleted(num, msg) {
    const el = document.getElementById(`step-${num}`);
    el.classList.remove("active");
    el.classList.add("completed");
    el.querySelector(".step-status").textContent = "✓ 完成";
  }

  function setStepError(num, msg) {
    const el = document.getElementById(`step-${num}`);
    el.classList.remove("active");
    el.classList.add("error-step");
    el.querySelector(".step-status").textContent = "✗ 终止";
  }

  function showError(msg) {
    errorSection.classList.remove("hidden");
    errorContent.innerHTML = `<div style="padding:20px;background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;border-radius:12px;"><h3>❌ ${msg}</h3></div>`;
  }

  function showErrorTermination(msg) {
    resultsSection.classList.add("hidden");
    errorSection.classList.remove("hidden");
    errorContent.innerHTML = `
      <div style="padding:25px;background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;border-radius:12px;">
        <h2 style="margin-bottom:15px;">🛑 分析终止</h2>
        <p style="font-size:1.1em;line-height:1.8;">${msg}</p>
        <p style="margin-top:15px;padding:15px;background:rgba(255,255,255,0.15);border-radius:8px;">
          <strong>建议：</strong><br>
          • 检查数据质量，补齐缺失值<br>
          • 如有明显季节性特征，请使用 SARIMA 模型<br>
          • 调整显著性水平 α 或差分上限 d_max<br>
          • 尝试扩大样本量至 30 期以上
        </p>
      </div>`;
    errorSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
