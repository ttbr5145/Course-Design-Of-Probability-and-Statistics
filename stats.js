// ============================================================
// 统计与数学工具库
// ============================================================

const Stats = (function () {
  // ---------- 基础统计 ----------
  function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function variance(arr, sampleMean) {
    if (arr.length <= 1) return 0;
    const m = sampleMean !== undefined ? sampleMean : mean(arr);
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
    return s / (arr.length - 1);
  }

  function stddev(arr) {
    return Math.sqrt(variance(arr));
  }

  // ---------- 数学辅助 ----------
  // 标准正态分布 CDF 近似
  function normalCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327 * Math.exp(-x * x / 2);
    const p =
      d *
      t *
      (0.3193815 +
        t *
          (-0.3565638 +
            t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }

  // 标准正态分布分位数近似（Beasley-Springer-Moro）
  function normalPdf(x) {
    return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  }

  // chi-square CDF（常规近似，使用正则化不完全 Gamma）
  function chiSquareCdf(x, df) {
    if (x <= 0) return 0;
    if (df <= 0) return 1;
    // 使用正则化不完全伽马函数 P(a, x)
    return regularizedGammaP(df / 2, x / 2);
  }

  // 正则化不完全伽马 P(a, x) 级数展开 + 连分数
  function regularizedGammaP(a, x) {
    if (x < 0 || a <= 0) return 0;
    if (x < a + 1) {
      // 级数展开
      let term = 1 / a;
      let sum = term;
      for (let n = 1; n <= 100; n++) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    } else {
      // 连分数（Lentz 方法）
      return 1 - regularizedGammaQ(a, x);
    }
  }

  function regularizedGammaQ(a, x) {
    // 连分数 Q(a, x)
    const eps = 1e-12;
    const fpmin = 1e-300;
    let b = x + 1 - a;
    let c = 1 / fpmin;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < fpmin) d = fpmin;
      c = b + an / c;
      if (Math.abs(c) < fpmin) c = fpmin;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < eps) break;
    }
    return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  }

  // Lanczos 近似 log Gamma
  function logGamma(x) {
    const g = 7;
    const c = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7,
    ];
    if (x < 0.5) {
      return (
        Math.log(Math.PI / Math.sin(Math.PI * x)) -
        logGamma(1 - x)
      );
    }
    x -= 1;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  // ---------- 差分 ----------
  function diff(arr, order) {
    let result = arr.slice();
    for (let k = 0; k < order; k++) {
      const newArr = [];
      for (let i = 1; i < result.length; i++) {
        newArr.push(result[i] - result[i - 1]);
      }
      result = newArr;
    }
    return result;
  }

  // 逆差分（还原预测值到原始尺度）
  function invDiff(predArr, origArr, order) {
    if (order === 0) return predArr.slice();
    let result = predArr.slice();
    for (let k = 0; k < order; k++) {
      const newArr = [];
      // 起点：原始序列最后一个值
      let last = origArr[origArr.length - 1 - k];
      // 如果预测值是多步，需要链式
      // 注意：origArr 是经过 k 阶差分之前的序列
      // 这里简单实现：把每一步的差分累加还原
      const prev = k === 0 ? origArr : null;
      if (prev) {
        last = prev[prev.length - 1];
      }
      // 实际上需要传递更完整信息，下面 app 中会处理
      for (let i = 0; i < result.length; i++) {
        newArr.push(result[i] + last);
        last = newArr[i];
      }
      result = newArr;
    }
    return result;
  }

  // ---------- ACF / PACF ----------
  // 计算 ACF（自相关函数）到 maxLag 阶
  function acf(series, maxLag) {
    const n = series.length;
    const m = mean(series);
    const centered = series.map((v) => v - m);
    const denom = centered.reduce((a, v) => a + v * v, 0);
    const result = [];
    for (let lag = 0; lag <= maxLag; lag++) {
      let num = 0;
      for (let i = lag; i < n; i++) num += centered[i] * centered[i - lag];
      result.push(num / denom);
    }
    return result;
  }

  // PACF 使用 Durbin-Levinson 递推
  function pacf(series, maxLag) {
    const acfVals = acf(series, maxLag);
    const phi = []; // phi[k][j]
    const pacfVals = [1];
    // phi_11
    const phi11 = acfVals[1];
    pacfVals.push(phi11);
    let prevPhi = [phi11];
    for (let k = 2; k <= maxLag; k++) {
      let numer = acfVals[k];
      let denom = 1;
      for (let j = 1; j <= k - 1; j++) {
        numer -= prevPhi[j - 1] * acfVals[k - j];
        denom -= prevPhi[j - 1] * acfVals[j];
      }
      const phikk = numer / denom;
      const newPhi = new Array(k);
      for (let j = 1; j <= k - 1; j++) {
        newPhi[j - 1] = prevPhi[j - 1] - phikk * prevPhi[k - j - 1];
      }
      newPhi[k - 1] = phikk;
      pacfVals.push(phikk);
      prevPhi = newPhi;
    }
    return pacfVals;
  }

  // ---------- ADF 单位根检验（简化版） ----------
  // 使用 Dickey-Fuller 回归估计
  // 返回 { stat, pValue, lags } 近似
  function adfTest(series, maxLag) {
    const n = series.length;
    if (n < 10) return { stat: 0, pValue: 1, lags: 0, isStationary: false };
    // 使用 AIC 选择滞后阶数
    let bestLag = 1;
    let bestStat = Infinity;
    let bestPValue = 1;
    const lagRange = maxLag || Math.max(1, Math.floor(Math.pow(n, 1 / 3)));

    for (let lag = 0; lag <= Math.min(lagRange, Math.floor(n / 10)); lag++) {
      const result = adfRegression(series, lag);
      if (result && result.stat < bestStat) {
        bestStat = result.stat;
        bestLag = lag;
        bestPValue = result.pValue;
      }
    }

    // 使用近似临界值
    // Dickey-Fuller 分布的近似：根据统计量估计 p-value
    // 使用 MacKinnon 近似公式的经验值
    const stat = bestStat;
    // 近似临界值（带常数项模型）
    const critical = {
      "0.01": -3.43 + 6.14 / n - 42.14 / (n * n),
      "0.05": -2.86 + 2.74 / n - 12.5 / (n * n),
      "0.10": -2.57 + 1.36 / n - 3.47 / (n * n),
    };
    // 线性插值估计 p-value
    let pValue;
    if (stat <= critical["0.01"]) pValue = 0.005;
    else if (stat <= critical["0.05"]) pValue = 0.03;
    else if (stat <= critical["0.10"]) pValue = 0.075;
    else {
      // 非平稳区域，p > 0.10
      // 粗略估计
      const t = (stat - critical["0.10"]) / (critical["0.10"] - critical["0.05"]);
      pValue = Math.min(1, 0.10 + 0.1 * Math.max(0, t));
    }
    return { stat: stat, pValue: pValue, lags: bestLag, critical: critical };
  }

  function adfRegression(series, lag) {
    // Δy_t = α + ρ*y_{t-1} + Σ_{i=1}^{lag} β_i * Δy_{t-i} + ε_t
    // 检验 ρ = 0
    const n = series.length;
    const dy = [];
    for (let i = 1; i < n; i++) dy.push(series[i] - series[i - 1]);
    const T = dy.length - lag;
    if (T < lag + 3) return null;

    // 构造 X: [1, y_{t-1}, Δy_{t-1}, ..., Δy_{t-lag}]
    const X = [];
    const Y = [];
    for (let t = lag; t < dy.length; t++) {
      const row = [1, series[t]]; // y_{t} (注意索引)
      // 实际: y_{t-1} = series[t]
      for (let j = 1; j <= lag; j++) {
        row.push(dy[t - j]);
      }
      X.push(row);
      Y.push(dy[t]);
    }
    const coefs = ols(X, Y);
    if (!coefs) return null;
    // rho 的 t 值
    const rho = coefs[1];
    // 计算残差与标准误
    let residuals = [];
    let yhatMean = 0;
    for (let i = 0; i < X.length; i++) {
      let pred = 0;
      for (let j = 0; j < X[i].length; j++) pred += X[i][j] * coefs[j];
      residuals.push(Y[i] - pred);
    }
    const sigma2 =
      residuals.reduce((a, v) => a + v * v, 0) / (X.length - X[0].length);
    // (X'X)^{-1}
    const xtxInv = invertMatrix(matrixMultiply(transpose(X), X));
    if (!xtxInv) return null;
    const se = Math.sqrt(Math.max(0, sigma2 * xtxInv[1][1]));
    const tStat = se === 0 ? 0 : rho / se;
    return { stat: tStat, rho: rho };
  }

  // ---------- 矩阵运算 ----------
  function transpose(m) {
    const r = m.length;
    const c = m[0].length;
    const out = [];
    for (let j = 0; j < c; j++) {
      const row = [];
      for (let i = 0; i < r; i++) row.push(m[i][j]);
      out.push(row);
    }
    return out;
  }

  function matrixMultiply(a, b) {
    const r = a.length;
    const c = b[0].length;
    const m = b.length;
    const out = [];
    for (let i = 0; i < r; i++) {
      const row = [];
      for (let j = 0; j < c; j++) {
        let s = 0;
        for (let k = 0; k < m; k++) s += a[i][k] * b[k][j];
        row.push(s);
      }
      out.push(row);
    }
    return out;
  }

  function matrixVectorMultiply(m, v) {
    const out = [];
    for (let i = 0; i < m.length; i++) {
      let s = 0;
      for (let j = 0; j < m[i].length; j++) s += m[i][j] * v[j];
      out.push(s);
    }
    return out;
  }

  // Gauss-Jordan 矩阵求逆
  function invertMatrix(m) {
    const n = m.length;
    const aug = [];
    for (let i = 0; i < n; i++) {
      const row = m[i].slice();
      for (let j = 0; j < n; j++) row.push(i === j ? 1 : 0);
      aug.push(row);
    }
    for (let i = 0; i < n; i++) {
      // 选主元
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
      }
      if (Math.abs(aug[maxRow][i]) < 1e-15) {
        // 奇异矩阵，加入正则项重试
        return null;
      }
      [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
      const pivot = aug[i][i];
      for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
      }
    }
    const inv = [];
    for (let i = 0; i < n; i++) {
      inv.push(aug[i].slice(n));
    }
    return inv;
  }

  // OLS 回归
  function ols(X, Y) {
    const Xt = transpose(X);
    const XtX = matrixMultiply(Xt, X);
    let XtXinv = invertMatrix(XtX);
    if (!XtXinv) {
      // 加入岭正则
      const n = XtX.length;
      for (let i = 0; i < n; i++) XtX[i][i] += 1e-8;
      XtXinv = invertMatrix(XtX);
      if (!XtXinv) return null;
    }
    const XtY = matrixVectorMultiply(Xt, Y);
    return matrixVectorMultiply(XtXinv, XtY);
  }

  // OLS 带标准误和 p-value
  function olsWithStats(X, Y) {
    const n = Y.length;
    const k = X[0].length;
    const coefs = ols(X, Y);
    if (!coefs) return null;
    const residuals = [];
    for (let i = 0; i < n; i++) {
      let pred = 0;
      for (let j = 0; j < k; j++) pred += X[i][j] * coefs[j];
      residuals.push(Y[i] - pred);
    }
    const sigma2 = residuals.reduce((a, v) => a + v * v, 0) / (n - k);
    const XtXinv = invertMatrix(matrixMultiply(transpose(X), X));
    if (!XtXinv) return { coefs: coefs, residuals: residuals, se: null, tStats: null, pValues: null };
    const se = [];
    const tStats = [];
    const pValues = [];
    for (let i = 0; i < k; i++) {
      const s = Math.sqrt(Math.max(0, sigma2 * XtXinv[i][i]));
      se.push(s);
      const t = s === 0 ? 0 : coefs[i] / s;
      tStats.push(t);
      // 用正态近似 p-value（大样本）
      const p = 2 * (1 - normalCdf(Math.abs(t)));
      pValues.push(p);
    }
    return { coefs: coefs, residuals: residuals, se: se, tStats: tStats, pValues: pValues, sigma2: sigma2 };
  }

  // ---------- ARIMA 模型 ----------
  // 条件最小二乘估计 ARIMA(p, d, q)
  // 对平稳序列（已差分）估计 AR(p) + MA(q)
  function fitARIMA(stationarySeries, p, q) {
    const n = stationarySeries.length;
    const m = mean(stationarySeries);
    const y = stationarySeries.map((v) => v - m);
    if (p === 0 && q === 0) {
      return {
        arCoefs: [],
        maCoefs: [],
        constant: m,
        residuals: y.slice(),
        sigma2: variance(y),
        success: true,
        pValues: [],
        se: [],
      };
    }
    // Hannan-Rissanen 方法：先用 AR 高阶估计，得到残差近似
    const arLags = Math.max(p, q, Math.floor(Math.min(15, n / 10)));
    // 估计 AR(arLags)
    const arResult = fitAR(y, arLags);
    let epsHat = arResult ? arResult.residuals : y.slice();
    // 构造回归矩阵
    const maxLag = Math.max(p, q);
    const T = n - maxLag;
    if (T < p + q + 5) {
      // 数据太少，退化为纯 AR
      if (q === 0) {
        const r = fitAR(y, p);
        if (!r) return null;
        return {
          arCoefs: r.coefs,
          maCoefs: [],
          constant: m,
          residuals: r.residuals,
          sigma2: r.sigma2,
          success: true,
          pValues: r.pValues,
          se: r.se,
        };
      }
      // 否则用简单条件最小二乘
    }
    // 构造 X
    const X = [];
    const Y = [];
    for (let t = maxLag; t < n; t++) {
      const row = [];
      for (let i = 1; i <= p; i++) row.push(y[t - i]);
      for (let j = 1; j <= q; j++) row.push(epsHat[t - j] || 0);
      X.push(row);
      Y.push(y[t]);
    }
    const fit = olsWithStats(X, Y);
    if (!fit) return null;
    const coefs = fit.coefs;
    const arCoefs = coefs.slice(0, p);
    const maCoefs = coefs.slice(p, p + q);
    // 重新计算残差（使用真实残差递推）
    const residuals = computeResiduals(y, arCoefs, maCoefs, maxLag);
    const sigma2 =
      residuals.reduce((a, v) => a + v * v, 0) / (residuals.length - p - q - 1 || 1);
    // 检查 AR 平稳性与 MA 可逆性
    const arStationary = checkARStationary(arCoefs);
    const maInvertible = checkMAInvertible(maCoefs);
    return {
      arCoefs: arCoefs,
      maCoefs: maCoefs,
      constant: m,
      residuals: residuals,
      sigma2: sigma2,
      success: true,
      pValues: fit.pValues,
      se: fit.se,
      tStats: fit.tStats,
      arStationary: arStationary,
      maInvertible: maInvertible,
      numParams: p + q,
      numObs: residuals.length,
    };
  }

  function computeResiduals(y, arCoefs, maCoefs, maxLag) {
    const n = y.length;
    const eps = new Array(n).fill(0);
    const p = arCoefs.length;
    const q = maCoefs.length;
    for (let t = 0; t < n; t++) {
      let pred = 0;
      for (let i = 1; i <= p; i++) if (t - i >= 0) pred += arCoefs[i - 1] * y[t - i];
      for (let j = 1; j <= q; j++) if (t - j >= 0) pred += maCoefs[j - 1] * eps[t - j];
      eps[t] = y[t] - pred;
    }
    return eps;
  }

  function fitAR(y, p) {
    const n = y.length;
    if (n <= p + 2) return null;
    const X = [];
    const Y = [];
    for (let t = p; t < n; t++) {
      const row = [];
      for (let i = 1; i <= p; i++) row.push(y[t - i]);
      X.push(row);
      Y.push(y[t]);
    }
    const fit = olsWithStats(X, Y);
    if (!fit) return null;
    return {
      coefs: fit.coefs,
      residuals: fit.residuals,
      sigma2: fit.sigma2,
      pValues: fit.pValues,
      se: fit.se,
    };
  }

  // AR 特征根检验（用 Durbin 递推算多项式根的绝对值最大值）
  function checkARStationary(arCoefs) {
    if (arCoefs.length === 0) return true;
    // 1 - φ1 z - φ2 z^2 - ... 的根都在单位圆外则平稳
    // 使用 Schur-Cohn 检验或直接找根（简化：用伴随矩阵特征值绝对值）
    return polyRootsMaxAbs(arCoefs) < 1;
  }

  function checkMAInvertible(maCoefs) {
    if (maCoefs.length === 0) return true;
    // 1 + θ1 z + θ2 z^2 + ... 的根都在单位圆外则可逆
    // 取负号后同样判断
    const negCoefs = maCoefs.map((c) => -c);
    return polyRootsMaxAbs(negCoefs) < 1;
  }

  // 估计多项式 1 - c1 z - c2 z^2 - ... 的最大根绝对值
  // 使用伴随矩阵 + 幂迭代（简化的估计）
  function polyRootsMaxAbs(coefs) {
    const p = coefs.length;
    if (p === 0) return 0;
    // 构造伴随矩阵
    const M = [];
    for (let i = 0; i < p; i++) {
      const row = new Array(p).fill(0);
      row[0] = coefs[i];
      if (i > 0) row[i] = 0;
      M.push(row);
    }
    for (let i = 1; i < p; i++) {
      M[i][i - 1] = 1;
    }
    // 幂迭代估计最大特征值
    let v = new Array(p).fill(1 / Math.sqrt(p));
    for (let iter = 0; iter < 100; iter++) {
      const vNew = matrixVectorMultiply([v], M)[0];
      // 实际上我们需要 M^T v
      // 简单实现：对 M^T
      const w = new Array(p).fill(0);
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) w[j] += M[k][j] * v[k];
      }
      const norm = Math.sqrt(w.reduce((a, v2) => a + v2 * v2, 0));
      if (norm < 1e-12) return 0;
      v = w.map((x) => x / norm);
    }
    // 计算 Rayleigh 商
    const w2 = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) w2[j] += M[k][j] * v[k];
    }
    let num = 0,
      den = 0;
    for (let i = 0; i < p; i++) {
      num += v[i] * w2[i];
      den += v[i] * v[i];
    }
    return Math.abs(num / den);
  }

  // ---------- 信息准则 ----------
  function aic(residuals, numParams) {
    const n = residuals.length;
    const ssr = residuals.reduce((a, v) => a + v * v, 0);
    const sigma2 = ssr / n;
    if (sigma2 <= 0) return Infinity;
    return 2 * numParams + n * Math.log(sigma2) + 2 * numParams * (numParams + 1) / Math.max(1, n - numParams - 1);
  }

  function bic(residuals, numParams) {
    const n = residuals.length;
    const ssr = residuals.reduce((a, v) => a + v * v, 0);
    const sigma2 = ssr / n;
    if (sigma2 <= 0) return Infinity;
    return Math.log(n) * numParams + n * Math.log(sigma2);
  }

  // ---------- Ljung-Box Q 检验 ----------
  function ljungBoxTest(series, maxLag) {
    const n = series.length;
    const acfVals = acf(series, maxLag);
    let Q = 0;
    for (let k = 1; k <= maxLag; k++) {
      Q += (acfVals[k] * acfVals[k]) / (n - k);
    }
    Q *= n * (n + 2);
    const df = maxLag;
    const pValue = 1 - chiSquareCdf(Q, df);
    return { Q: Q, df: df, pValue: pValue };
  }

  // ---------- 季节性检测 ----------
  // 通过 ACF 在若干滞后处的显著峰值检测季节性
  function detectSeasonality(series) {
    const n = series.length;
    const maxLag = Math.min(Math.floor(n / 4), 48);
    const acfVals = acf(series, maxLag);
    // 95% 置信区间
    const ci = 1.96 / Math.sqrt(n);
    const peaks = [];
    for (let lag = 2; lag < maxLag; lag++) {
      if (
        acfVals[lag] > ci &&
        acfVals[lag] > acfVals[lag - 1] &&
        acfVals[lag] > acfVals[lag + 1]
      ) {
        peaks.push({ lag: lag, value: acfVals[lag] });
      }
    }
    // 检查是否有强周期：连续滞后为周期倍数
    peaks.sort((a, b) => b.value - a.value);
    if (peaks.length > 0) {
      const topLag = peaks[0].lag;
      // 检查是否有 2*lag 也显著
      const hasDouble = peaks.some(
        (p) => Math.abs(p.lag - 2 * topLag) <= 1 && p.value > ci
      );
      return {
        hasSeasonality: peaks[0].value > 0.5 || (peaks[0].value > 0.3 && hasDouble),
        period: topLag,
        acfPeaks: peaks.slice(0, 5),
        ci: ci,
      };
    }
    return { hasSeasonality: false, period: null, acfPeaks: [], ci: ci };
  }

  // ---------- ARIMA 预测 ----------
  function forecastARIMA(fittedModel, stationarySeries, steps, originalLastValues, d) {
    // 对平稳序列做预测，然后逆差分
    const y = stationarySeries.map((v) => v - fittedModel.constant);
    const n = y.length;
    const p = fittedModel.arCoefs.length;
    const q = fittedModel.maCoefs.length;
    const ar = fittedModel.arCoefs;
    const ma = fittedModel.maCoefs;

    // 先计算历史残差（使用 fittedModel.residuals 或重算）
    const eps = fittedModel.residuals.slice();
    // 预测值（平稳尺度）
    const yHat = [];
    const extendedY = y.slice();
    const extendedEps = eps.slice();
    for (let h = 0; h < steps; h++) {
      let pred = 0;
      for (let i = 1; i <= p; i++) {
        const idx = extendedY.length - i;
        if (idx >= 0) pred += ar[i - 1] * extendedY[idx];
      }
      for (let j = 1; j <= q; j++) {
        const idx = extendedEps.length - j;
        if (idx >= 0) pred += ma[j - 1] * extendedEps[idx];
      }
      yHat.push(pred);
      extendedY.push(pred);
      extendedEps.push(0); // 未来残差期望为 0
    }
    // 加回常数项
    const stationaryPred = yHat.map((v) => v + fittedModel.constant);
    // 逆差分还原
    if (d === 0) return stationaryPred;
    // 逆差分：需要原始序列的最近 d 个值
    return inverseDiffRecursive(stationaryPred, originalLastValues, d);
  }

  function inverseDiffRecursive(predArr, lastValues, d) {
    // lastValues: 原始序列末尾的 d 个或更多值（从旧到新）
    // 逐步逆差分
    let result = predArr.slice();
    let history = lastValues.slice();
    for (let k = 0; k < d; k++) {
      const newResult = [];
      for (let i = 0; i < result.length; i++) {
        // 累积和 + 前一值
        if (i === 0) {
          newResult.push(result[i] + history[history.length - 1 - k]);
        } else {
          newResult.push(result[i] + newResult[i - 1]);
        }
      }
      result = newResult;
    }
    return result;
  }

  // 一步预测（训练集内预测）
  function fittedValuesARIMA(fittedModel, stationarySeries) {
    const y = stationarySeries.map((v) => v - fittedModel.constant);
    const n = y.length;
    const p = fittedModel.arCoefs.length;
    const q = fittedModel.maCoefs.length;
    const ar = fittedModel.arCoefs;
    const ma = fittedModel.maCoefs;
    const eps = fittedModel.residuals;
    const fitted = new Array(n).fill(fittedModel.constant);
    for (let t = 0; t < n; t++) {
      let pred = 0;
      for (let i = 1; i <= p; i++) {
        if (t - i >= 0) pred += ar[i - 1] * y[t - i];
      }
      for (let j = 1; j <= q; j++) {
        if (t - j >= 0) pred += ma[j - 1] * eps[t - j];
      }
      fitted[t] = pred + fittedModel.constant;
    }
    return fitted;
  }

  // ---------- 预测误差指标 ----------
  function forecastMetrics(actual, predicted) {
    const n = Math.min(actual.length, predicted.length);
    let mae = 0,
      mse = 0,
      mape = 0,
      rmse = 0;
    let validCount = 0;
    for (let i = 0; i < n; i++) {
      const err = actual[i] - predicted[i];
      mae += Math.abs(err);
      mse += err * err;
      if (Math.abs(actual[i]) > 1e-10) {
        mape += Math.abs(err / actual[i]);
        validCount++;
      }
    }
    mae /= n;
    mse /= n;
    rmse = Math.sqrt(mse);
    mape = validCount > 0 ? (mape / validCount) * 100 : NaN;
    return { MAE: mae, MSE: mse, RMSE: rmse, MAPE: mape };
  }

  // ---------- 数据缺失检测 ----------
  function checkMissing(data) {
    let count = 0;
    const positions = [];
    for (let i = 0; i < data.length; i++) {
      if (
        data[i] === null ||
        data[i] === undefined ||
        isNaN(data[i]) ||
        data[i] === ""
      ) {
        count++;
        positions.push(i);
      }
    }
    return { count: count, positions: positions, hasMissing: count > 0 };
  }

  // ---------- 异常值检测（3σ 法则） ----------
  function detectOutliers(series) {
    const m = mean(series);
    const s = stddev(series);
    const outliers = [];
    for (let i = 0; i < series.length; i++) {
      if (Math.abs(series[i] - m) > 3 * s) outliers.push({ index: i, value: series[i] });
    }
    return outliers;
  }

  return {
    mean: mean,
    variance: variance,
    stddev: stddev,
    normalCdf: normalCdf,
    chiSquareCdf: chiSquareCdf,
    diff: diff,
    acf: acf,
    pacf: pacf,
    adfTest: adfTest,
    fitARIMA: fitARIMA,
    aic: aic,
    bic: bic,
    ljungBoxTest: ljungBoxTest,
    detectSeasonality: detectSeasonality,
    forecastARIMA: forecastARIMA,
    fittedValuesARIMA: fittedValuesARIMA,
    forecastMetrics: forecastMetrics,
    checkMissing: checkMissing,
    detectOutliers: detectOutliers,
    ols: ols,
    olsWithStats: olsWithStats,
  };
})();
