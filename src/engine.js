// ══════════════════════════════════════════════════
// 位移法計算引擎
// 符號規定：逆時針為正（與 Midas 一致）
// 方法：傾角變位公式（slope-deflection method）
// ══════════════════════════════════════════════════

// ── 固端彎矩（Fixed End Moments）──
// 逆時針正，兩端固定假設
// 回傳 [M_near, M_far]
export function calcFEM(type, val, pos, L) {
  const P = val, a = pos, b = L - a
  switch (type) {
    case 'point':
      return [
         (P * a * b * b) / (L * L),
        -(P * a * a * b) / (L * L),
      ]
    case 'udl':
      return [
         (P * L * L) / 12,
        -(P * L * L) / 12,
      ]
    case 'tri_inc': // 近端=0，遠端=w₀
      return [
         (P * L * L) / 30,
        -(P * L * L) / 20,
      ]
    case 'tri_dec': // 近端=w₀，遠端=0
      return [
         (P * L * L) / 20,
        -(P * L * L) / 30,
      ]
    case 'moment': { // 集中彎矩 M @a
      const bv = b
      return [
         (P * bv * (2 * a - bv)) / (L * L),
         (P * a  * (2 * bv - a)) / (L * L),
      ]
    }
    case 'none':
    default:
      return [0, 0]
  }
}

// ── 傾角變位公式（Slope-Deflection Equation）──
// M_ij = (2EI/L)(2θ_i + θ_j - 3ψ) + M^F_ij
// 逆時針正，ψ = Δ/L（chord rotation，側移角）
export function slopeDeflection(EI, L, thetaI, thetaJ, psi, femNear) {
  return (2 * EI / L) * (2 * thetaI + thetaJ - 3 * psi) + femNear
}

// ── 高斯消去法 ──
export function gaussElim(A, b) {
  const n = b.length
  if (n === 0) return []
  const M = A.map((r, i) => [...r, b[i]])
  for (let col = 0; col < n; col++) {
    let mx = col
    for (let r = col + 1; r < n; r++)
      if (Math.abs(M[r][col]) > Math.abs(M[mx][col])) mx = r
    ;[M[col], M[mx]] = [M[mx], M[col]]
    if (Math.abs(M[col][col]) < 1e-14) continue
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    if (Math.abs(M[i][i]) > 1e-14) x[i] /= M[i][i]
  }
  return x
}

// ── 主求解器：無側移連續梁 ──
// supports: 'fixed'|'pin'|'roller'|'free' （各節點）
// spans: [{L, EI_mult, load_type, load_val, load_pos}]
// EI_base: 基準 EI（kN·m²）
export function solveBeamDisplacementMethod(spans, supports, EI_base) {
  const n = spans.length
  const nNodes = n + 1
  const NL = ['A', 'B', 'C', 'D', 'E']

  // 1. 計算各跨 EI 和 FEM
  const spanData = spans.map((sp) => {
    const EI = EI_base * (sp.EI_mult ?? 1)
    const [femNear, femFar] = calcFEM(sp.load_type, sp.load_val, sp.load_pos, sp.L)
    return { ...sp, EI, femNear, femFar }
  })

  // 2. 判斷自由 DOF（有轉角自由度的節點）
  // pin / roller / free → θ 自由；fixed → θ = 0
  const freeDOFs = [] // 節點 index
  for (let i = 0; i < nNodes; i++) {
    const sup = supports[i] || 'pin'
    if (sup === 'pin' || sup === 'roller' || sup === 'free') freeDOFs.push(i)
  }
  const nd = freeDOFs.length

  // 3. 組裝剛度矩陣 [K] 和載重向量 {F}
  const K = Array.from({ length: nd }, () => new Array(nd).fill(0))
  const F = new Array(nd).fill(0)

  for (let si = 0; si < n; si++) {
    const { L, EI, femNear, femFar } = spanData[si]
    const ni = si, nj = si + 1
    const ii = freeDOFs.indexOf(ni)
    const ij = freeDOFs.indexOf(nj)

    // 傾角變位公式對 θ 的偏微分係數
    // M_ij = (2EI/L)(2θ_i + θ_j) + FEM → ∂M_ij/∂θ_i = 4EI/L, ∂M_ij/∂θ_j = 2EI/L
    // 節點平衡 ΣM = 0 → K 矩陣組裝
    if (ii >= 0) {
      K[ii][ii] += 4 * EI / L
      if (ij >= 0) K[ii][ij] += 2 * EI / L
      F[ii] -= femNear // 右手側：負的 FEM（不平衡力矩）
    }
    if (ij >= 0) {
      K[ij][ij] += 4 * EI / L
      if (ii >= 0) K[ij][ii] += 2 * EI / L
      F[ij] -= femFar
    }
  }

  // 4. 求解轉角
  const thetaFree = nd > 0 ? gaussElim(K, F) : []
  const theta = new Array(nNodes).fill(0)
  freeDOFs.forEach((ni, ii) => { theta[ni] = thetaFree[ii] })

  // 5. 回代：各桿端彎矩
  const M = spanData.map((sp, i) => {
    const { L, EI, femNear, femFar } = sp
    const Mij = slopeDeflection(EI, L, theta[i],   theta[i+1], 0, femNear)
    const Mji = slopeDeflection(EI, L, theta[i+1], theta[i],   0, femFar)
    return { Mij, Mji }
  })

  // 6. 支承反力
  const R = new Array(nNodes).fill(0)
  const Rm = new Array(nNodes).fill(0) // 固定端彎矩反力
  for (let si = 0; si < n; si++) {
    const { L, load_type, load_val: P, load_pos: a } = spanData[si]
    const { Mij, Mji } = M[si]
    let extMoment = 0, totalLoad = 0
    if (load_type === 'point')   { extMoment = P * a;       totalLoad = P }
    else if (load_type === 'udl')  { extMoment = P * L * L / 2; totalLoad = P * L }
    else if (load_type === 'tri_inc') { extMoment = P * L / 2 * 2 * L / 3; totalLoad = P * L / 2 }
    else if (load_type === 'tri_dec') { extMoment = P * L / 2 * L / 3;     totalLoad = P * L / 2 }
    else if (load_type === 'moment')  { extMoment = P;       totalLoad = 0 }

    const Rj = (extMoment - Mij + Mji) / L
    const Ri = totalLoad - Rj
    R[si]   += Ri
    R[si+1] += Rj
    if (supports[si]   === 'fixed') Rm[si]   = Mij
    if (supports[si+1] === 'fixed') Rm[si+1] = Mji
  }

  // 自由端反力強制為 0
  for (let i = 0; i < nNodes; i++) {
    if (supports[i] === 'free') R[i] = 0
  }

  return {
    spanData, theta, freeDOFs, K, F, M, R, Rm,
    nNodes, NL, nd,
  }
}

// ── FEM 公式說明文字 ──
export function femFormulaText(type, val, pos, L, mi, mj) {
  const P = val, a = pos, b = (L - a).toFixed(2)
  const fmt = (v) => v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3)
  switch (type) {
    case 'point':
      return [
        `M^F_近 = +Pab²/L² = ${P}×${a}×${b}²/${L}² = ${fmt(mi)} kN·m`,
        `M^F_遠 = −Pa²b/L² = ${fmt(mj)} kN·m`,
      ]
    case 'udl':
      return [
        `M^F_近 = +wL²/12 = ${P}×${L}²/12 = ${fmt(mi)} kN·m`,
        `M^F_遠 = −wL²/12 = ${fmt(mj)} kN·m`,
      ]
    case 'tri_inc':
      return [
        `M^F_近 = +w₀L²/30 = ${fmt(mi)} kN·m`,
        `M^F_遠 = −w₀L²/20 = ${fmt(mj)} kN·m`,
      ]
    case 'tri_dec':
      return [
        `M^F_近 = +w₀L²/20 = ${fmt(mi)} kN·m`,
        `M^F_遠 = −w₀L²/30 = ${fmt(mj)} kN·m`,
      ]
    case 'moment':
      return [
        `M^F_近 = Mb(2a−b)/L² = ${fmt(mi)} kN·m`,
        `M^F_遠 = Ma(2b−a)/L² = ${fmt(mj)} kN·m`,
      ]
    default:
      return ['無載重，固端彎矩 = 0']
  }
}
