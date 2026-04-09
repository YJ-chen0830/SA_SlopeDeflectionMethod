import { useState, useCallback } from 'react'
import './index.css'
import { solveBeamDisplacementMethod, calcFEM, femFormulaText } from './engine'
import DiagramSVG from './DiagramSVG'

const NODE_LABELS = ['A', 'B', 'C', 'D', 'E']
const SUP_TYPES = [
  { val: 'fixed',  label: '固定端' },
  { val: 'pin',    label: '鉸支承' },
  { val: 'roller', label: '滾支承' },
  { val: 'free',   label: '自由端' },
]
const LOAD_TYPES = [
  { val: 'none',    label: '無載重' },
  { val: 'point',   label: '集中力 P' },
  { val: 'udl',     label: '均布載重 w' },
  { val: 'tri_inc', label: '三角形↑ w₀' },
  { val: 'tri_dec', label: '三角形↓ w₀' },
  { val: 'moment',  label: '集中彎矩 M' },
]

function fmt(v, d = 3) {
  if (Math.abs(v) < 1e-9) return '0'
  return v >= 0 ? `+${v.toFixed(d)}` : v.toFixed(d)
}
function fmtN(v, d = 3) {
  if (Math.abs(v) < 1e-9) return '0'
  return v.toFixed(d)
}

// ── 步驟卡片 ──
function StepCard({ num, title, tag, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`step-card shown ${open ? 'open' : ''} ${defaultOpen ? 'active' : ''}`}>
      <div className="step-hdr" onClick={() => setOpen(o => !o)}>
        <div className="step-num">{String(num).padStart(2, '0')}</div>
        <div className="step-title">{title}</div>
        <span className="step-tag">{tag}</span>
        <span className="chev">›</span>
      </div>
      <div className="step-body">{children}</div>
    </div>
  )
}

// ── 主元件 ──
export default function App() {
  const [nSpans, setNSpans] = useState(2)
  const [EI_base, setEIBase] = useState(20000)
  const [spans, setSpans] = useState([
    { L: 6, EI_mult: 1, load_type: 'udl', load_val: 20, load_pos: 3 },
    { L: 6, EI_mult: 1, load_type: 'point', load_val: 30, load_pos: 3 },
  ])
  const [supports, setSupports] = useState(['fixed', 'roller', 'pin'])
  const [result, setResult] = useState(null)

  // 更新桿件設定
  const updateSpan = (i, key, val) => {
    setSpans(prev => prev.map((sp, idx) => idx === i ? { ...sp, [key]: val } : sp))
  }

  // 更新跨數
  const changeNSpans = (n) => {
    setNSpans(n)
    setSpans(prev => {
      const next = [...prev]
      while (next.length < n) next.push({ L: 6, EI_mult: 1, load_type: 'none', load_val: 0, load_pos: 3 })
      return next.slice(0, n)
    })
    setSupports(prev => {
      const next = [...prev]
      while (next.length < n + 1) next.push('roller')
      return next.slice(0, n + 1)
    })
  }

  // 求解
  const solve = useCallback(() => {
    try {
      const res = solveBeamDisplacementMethod(spans.slice(0, nSpans), supports.slice(0, nSpans + 1), EI_base)
      setResult(res)
    } catch (e) {
      console.error(e)
    }
  }, [spans, supports, EI_base, nSpans])

  return (
    <div className="app">
      {/* ── 側邊欄 ── */}
      <div className="sidebar">
        <div className="sb-hdr">
          <div className="logo">結構學<span>解題引擎</span></div>
          <div className="version">v1.0 · 位移法 · 傾角變位法</div>
        </div>

        <div className="sb-body">
          {/* 跨數 */}
          <div className="sb-section">
            <span className="sb-label">跨數</span>
            <div className="num-row">
              {[1, 2, 3, 4].map(n => (
                <button key={n} className={`num-btn ${nSpans === n ? 'active' : ''}`} onClick={() => changeNSpans(n)}>{n}</button>
              ))}
            </div>
          </div>

          {/* 全域 EI */}
          <div className="sb-section">
            <span className="sb-label">材料（基準值）</span>
            <div className="field">
              <label>EI 基準值 (kN·m²)</label>
              <input type="number" value={EI_base} onChange={e => setEIBase(+e.target.value)} step="1000" />
            </div>
          </div>

          {/* 各跨設定 */}
          <div className="sb-section">
            <span className="sb-label">桿件設定</span>
            {spans.slice(0, nSpans).map((sp, i) => (
              <div className="span-card" key={i}>
                <div className="span-card-title">桿件 {NODE_LABELS[i]}–{NODE_LABELS[i+1]}</div>
                <div className="grid2">
                  <div className="field">
                    <label>L (m)</label>
                    <input type="number" value={sp.L} onChange={e => updateSpan(i, 'L', +e.target.value)} step="0.5" min="0.1" />
                  </div>
                  <div className="field">
                    <label>EI 倍率</label>
                    <input type="number" value={sp.EI_mult} onChange={e => updateSpan(i, 'EI_mult', +e.target.value)} step="0.5" min="0.1" />
                  </div>
                </div>
                <div className="field">
                  <label>載重類型</label>
                  <select value={sp.load_type} onChange={e => updateSpan(i, 'load_type', e.target.value)}>
                    {LOAD_TYPES.map(lt => <option key={lt.val} value={lt.val}>{lt.label}</option>)}
                  </select>
                </div>
                {sp.load_type !== 'none' && (
                  <div className="grid2">
                    <div className="field">
                      <label>{sp.load_type === 'udl' || sp.load_type.startsWith('tri') ? 'w₀ (kN/m)' : sp.load_type === 'moment' ? 'M (kN·m)' : 'P (kN)'}</label>
                      <input type="number" value={sp.load_val} onChange={e => updateSpan(i, 'load_val', +e.target.value)} step="1" />
                    </div>
                    {(sp.load_type === 'point' || sp.load_type === 'moment') && (
                      <div className="field">
                        <label>位置 a (m)</label>
                        <input type="number" value={sp.load_pos} onChange={e => updateSpan(i, 'load_pos', +e.target.value)} step="0.1" min="0" max={sp.L} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 支承 */}
          <div className="sb-section">
            <span className="sb-label">支承條件</span>
            {Array.from({ length: nSpans + 1 }, (_, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>節點 {NODE_LABELS[i]}</div>
                <div className="sup-row">
                  {SUP_TYPES.map(st => (
                    <button key={st.val} className={`sup-btn ${supports[i] === st.val ? 'active' : ''}`}
                      onClick={() => setSupports(prev => prev.map((s, idx) => idx === i ? st.val : s))}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <button className="solve-btn" onClick={solve}>▶ 開始逐步解題</button>
        </div>
      </div>

      {/* ── 主區域 ── */}
      <div className="main">
        <div className="main-hdr">
          <div className="main-title">位移法：連續梁分析</div>
          <div className="main-sub">傾角變位法 · 逆時針為正 · 逐步展示解題過程</div>
        </div>

        {/* 結構示意圖 */}
        <div className="diagram-box">
          <div className="box-label">結構示意圖</div>
          <DiagramSVG spans={spans.slice(0, nSpans)} supports={supports.slice(0, nSpans + 1)} />
        </div>

        {/* 解題步驟 */}
        {!result ? (
          <div className="placeholder">
            <div className="ph-icon">⚙</div>
            <div className="ph-text">設定結構參數<br />點擊「開始逐步解題」</div>
          </div>
        ) : (
          <ResultSteps result={result} spans={spans.slice(0, nSpans)} supports={supports.slice(0, nSpans + 1)} EI_base={EI_base} />
        )}
      </div>
    </div>
  )
}

// ── 解題步驟元件 ──
function ResultSteps({ result, spans, supports, EI_base }) {
  const { spanData, theta, freeDOFs, K, F, M, R, Rm, nNodes, NL, nd } = result
  const n = spans.length

  return (
    <>
      {/* 步驟一：自由度 */}
      <StepCard num={1} title="判斷自由度（DOF）" tag="傾角變位法前置" defaultOpen>
        <div className="concept">
          <strong>傾角變位法的核心思路</strong>
          以各節點的轉角 θ 為未知量。固定端 θ = 0（已知），鉸/滾支承的 θ 為自由未知量。
          本題共有 <strong>{nd}</strong> 個未知轉角，需列 {nd} 條方程式求解。
        </div>
        <div className="formula-block">
{`<span class="fc">// 各節點支承與自由度判斷</span>
${Array.from({ length: nNodes }, (_, i) => {
  const sup = supports[i]
  const isFree = freeDOFs.includes(i)
  const supDesc = { fixed: '固定端 → θ = 0（已知）', pin: '鉸支承 → θ 未知', roller: '滾支承 → θ 未知', free: '自由端 → θ 未知' }
  return `節點 ${NL[i]}：${supDesc[sup]}${isFree ? '' : ''}`
}).join('\n')}

<span class="fc">// 未知量</span>
自由 DOF：${freeDOFs.length > 0 ? freeDOFs.map(i => `θ_${NL[i]}`).join('、') : '（無，結構完全固定）'}
未知數個數：<span class="fr">${nd} 個</span>`}
        </div>
        <div className="note">
          <strong>考試提示：</strong>無側移連續梁只有轉角未知量。若有側移（剛架），還需加入側移角 ψ = Δ/L 作為未知量。
        </div>
      </StepCard>

      {/* 步驟二：固端彎矩 */}
      <StepCard num={2} title="計算固端彎矩（FEM）" tag="查表 / 公式">
        <div className="concept">
          <strong>假設所有節點完全固定</strong>，各桿件在外載重下產生的固端彎矩。
          本步驟只需查公式表代入，與結構整體無關。逆時針為正。
        </div>
        {spanData.map((sp, i) => {
          const lines = femFormulaText(sp.load_type, sp.load_val, sp.load_pos, sp.L, sp.femNear, sp.femFar)
          return (
            <div key={i}>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)', marginBottom: 6, marginTop: i > 0 ? 12 : 0 }}>
                桿件 {NL[i]}–{NL[i+1]}（L={sp.L}m，EI={sp.EI_mult === 1 ? 'EI' : `${sp.EI_mult}EI`}）
              </div>
              <div className="formula-block">{lines.map((l, j) => <div key={j}>{l}</div>)}</div>
            </div>
          )
        })}
        <table className="result-table" style={{ marginTop: 12 }}>
          <thead><tr><th>桿件</th><th>載重</th><th>M^F_近端 (kN·m)</th><th>M^F_遠端 (kN·m)</th></tr></thead>
          <tbody>
            {spanData.map((sp, i) => (
              <tr key={i}>
                <td>{NL[i]}–{NL[i+1]}</td>
                <td>{LOAD_TYPES.find(l => l.val === sp.load_type)?.label}</td>
                <td className={sp.femNear >= 0 ? 'pos' : 'neg'}>{fmtN(sp.femNear)}</td>
                <td className={sp.femFar  >= 0 ? 'pos' : 'neg'}>{fmtN(sp.femFar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </StepCard>

      {/* 步驟三：傾角變位公式 */}
      <StepCard num={3} title="列出各桿端傾角變位公式" tag="傾角變位公式">
        <div className="concept">
          <strong>傾角變位公式（逆時針正）</strong><br />
          M_ij = (2EI/L)(2θ_i + θ_j − 3ψ) + M^F_ij<br />
          無側移時 ψ = 0，固定端節點 θ = 0 直接代入化簡。
        </div>
        {spanData.map((sp, i) => {
          const { L, EI, femNear, femFar } = sp
          const tI = freeDOFs.includes(i)   ? `θ_${NL[i]}`   : '0'
          const tJ = freeDOFs.includes(i+1) ? `θ_${NL[i+1]}` : '0'
          const k = `2×${EI === EI_base ? 'EI' : `${sp.EI_mult}EI`}/${L}`
          return (
            <div key={i}>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)', marginBottom: 6, marginTop: i > 0 ? 14 : 0 }}>
                桿件 {NL[i]}–{NL[i+1]}
              </div>
              <div className="formula-block">
{`M_${NL[i]}${NL[i+1]} = (${k})(2×${tI} + ${tJ}) + (${fmtN(femNear)})
M_${NL[i+1]}${NL[i]} = (${k})(2×${tJ} + ${tI}) + (${fmtN(femFar)})`}
              </div>
            </div>
          )
        })}
      </StepCard>

      {/* 步驟四：節點平衡 */}
      <StepCard num={4} title="節點力矩平衡，求解未知轉角" tag="ΣM = 0">
        <div className="concept">
          <strong>節點力矩平衡條件</strong><br />
          對每個有自由轉角的節點列 ΣM = 0（作用在節點上的所有桿端彎矩之和 = 0）。
          代入步驟三的表達式，整理成線性方程組求解。
        </div>

        {freeDOFs.length === 0 ? (
          <div className="formula-block">{'無自由 DOF，結構為靜定或完全固定，不需建立方程式。'}</div>
        ) : (
          <>
            {/* 平衡方程 */}
            {freeDOFs.map((nodeIdx, eq) => {
              const leftSpan  = nodeIdx > 0 ? spanData[nodeIdx - 1] : null
              const rightSpan = nodeIdx < n  ? spanData[nodeIdx]     : null
              return (
                <div key={eq}>
                  <div style={{ fontSize: 12, color: 'var(--teal)', fontFamily: 'var(--mono)', marginBottom: 6, marginTop: eq > 0 ? 12 : 0 }}>
                    節點 {NL[nodeIdx]}：ΣM = 0
                  </div>
                  <div className="formula-block">
{[
  leftSpan  ? `M_${NL[nodeIdx]}${NL[nodeIdx-1]}` : null,
  rightSpan ? `M_${NL[nodeIdx]}${NL[nodeIdx+1]}` : null,
].filter(Boolean).join(' + ')} = 0
                  </div>
                </div>
              )
            })}

            {/* 求解結果 */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 8 }}>求解結果</div>
              <table className="result-table">
                <thead><tr><th>未知量</th><th>數值</th><th>單位</th></tr></thead>
                <tbody>
                  {freeDOFs.map((ni, ii) => (
                    <tr key={ii}>
                      <td>θ_{NL[ni]}</td>
                      <td className={theta[ni] >= 0 ? 'pos' : 'neg'}>{theta[ni].toExponential(4)}</td>
                      <td>rad</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </StepCard>

      {/* 步驟五：回代求桿端彎矩 */}
      <StepCard num={5} title="回代傾角變位公式，求各桿端彎矩" tag="最終內力">
        <div className="concept">
          <strong>將求得的 θ 代入步驟三的公式</strong>，即可求出各桿件兩端彎矩，再由靜力平衡求支承反力。
        </div>
        {spanData.map((sp, i) => {
          const { L, EI, femNear, femFar } = sp
          const { Mij, Mji } = M[i]
          const tI = theta[i], tJ = theta[i+1]
          return (
            <div key={i}>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)', marginBottom: 6, marginTop: i > 0 ? 14 : 0 }}>
                桿件 {NL[i]}–{NL[i+1]}
              </div>
              <div className="formula-block">
{`M_${NL[i]}${NL[i+1]} = (2×${EI}/L)(2×${tI.toFixed(5)} + ${tJ.toFixed(5)}) + ${fmtN(femNear)}
       = <span class="fr">${fmt(Mij)} kN·m</span>

M_${NL[i+1]}${NL[i]} = (2×${EI}/L)(2×${tJ.toFixed(5)} + ${tI.toFixed(5)}) + ${fmtN(femFar)}
       = <span class="fr">${fmt(Mji)} kN·m</span>`}
              </div>
            </div>
          )
        })}

        {/* 彎矩匯總表 */}
        <table className="result-table" style={{ marginTop: 14 }}>
          <thead><tr><th>桿端</th><th>彎矩 (kN·m)</th><th>桿端</th><th>彎矩 (kN·m)</th></tr></thead>
          <tbody>
            {M.map(({ Mij, Mji }, i) => (
              <tr key={i}>
                <td>M_{NL[i]}{NL[i+1]}</td>
                <td className={Math.abs(Mij) < 1e-6 ? '' : Mij > 0 ? 'pos hl' : 'neg hl'}>{fmtN(Mij)}</td>
                <td>M_{NL[i+1]}{NL[i]}</td>
                <td className={Math.abs(Mji) < 1e-6 ? '' : Mji > 0 ? 'pos hl' : 'neg hl'}>{fmtN(Mji)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 支承反力 */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 8 }}>支承反力</div>
          <table className="result-table">
            <thead><tr><th>節點</th><th>垂直反力 (kN)</th><th>彎矩反力 (kN·m)</th></tr></thead>
            <tbody>
              {R.map((rv, i) => (
                <tr key={i}>
                  <td>節點 {NL[i]}</td>
                  <td className={Math.abs(rv) < 1e-6 ? '' : rv > 0 ? 'pos' : 'neg'}>{fmtN(rv)}</td>
                  <td className={Math.abs(Rm[i]) < 1e-6 ? '' : Rm[i] > 0 ? 'pos' : 'neg'}>{fmtN(Rm[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="note">
          <strong>驗算：</strong>ΣFy = {fmtN(R.reduce((a, b) => a + b, 0))} kN（應等於總外力 {fmtN(spanData.reduce((s, sp) => {
            if (sp.load_type === 'udl') return s + sp.load_val * sp.L
            if (sp.load_type === 'point') return s + sp.load_val
            if (sp.load_type.startsWith('tri')) return s + sp.load_val * sp.L / 2
            return s
          }, 0))} kN）
        </div>
      </StepCard>

      {/* 最終答案 */}
      <div className={`ans-panel show`}>
        <div className="ans-title">▸ FINAL RESULTS — 位移法</div>
        <div className="ans-grid">
          {R.map((rv, i) => (
            <div className="ans-card" key={i}>
              <span className="ans-val">{fmtN(rv, 2)}</span>
              <div className="ans-desc">R_{NL[i]} (kN)</div>
            </div>
          ))}
          <div className="ans-card">
            <span className="ans-val amber">{fmtN(Math.max(...M.flatMap(m => [Math.abs(m.Mij), Math.abs(m.Mji)])), 2)}</span>
            <div className="ans-desc">最大彎矩 (kN·m)</div>
          </div>
        </div>
      </div>
    </>
  )
}
