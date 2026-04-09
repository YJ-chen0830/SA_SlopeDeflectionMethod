// DiagramSVG.jsx — 結構示意圖（純 SVG，無外部依賴）
export default function DiagramSVG({ spans, supports }) {
  const W = 660, H = 130
  const BY = 52, BH = 10
  const ML = 60, MR = 60
  const dW = W - ML - MR

  const Ls = spans.map(s => s.L)
  const totalL = Ls.reduce((a, b) => a + b, 0) || 1
  const nNodes = spans.length + 1
  const NL = ['A', 'B', 'C', 'D', 'E']

  // 節點 x 座標
  const xN = [ML]
  for (let i = 0; i < spans.length; i++) xN.push(xN[i] + (Ls[i] / totalL) * dW)

  const beamColor = '#3b82f6'
  const loadColor = '#f59e0b'
  const supColor  = '#6366f1'

  let defs = `<marker id="da" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M1 2L8 5L1 8" fill="none" stroke="${loadColor}" stroke-width="1.5"/>
  </marker>`

  let svg = ''

  // 梁體
  for (let i = 0; i < spans.length; i++) {
    const eim = spans[i].EI_mult || 1
    const opacity = Math.min(1, 0.5 + eim * 0.35)
    svg += `<rect x="${xN[i]}" y="${BY}" width="${xN[i+1] - xN[i]}" height="${BH}" fill="${beamColor}" opacity="${opacity.toFixed(2)}" rx="1"/>`
    // 跨長標註
    const mx = (xN[i] + xN[i+1]) / 2
    svg += `<text x="${mx}" y="${H - 4}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#556688">L${i+1}=${Ls[i]}m</text>`
  }

  // 載重圖示
  for (let i = 0; i < spans.length; i++) {
    const { load_type, load_val: P, load_pos: a, L } = spans[i]
    const sw = xN[i+1] - xN[i]

    if (load_type === 'point') {
      const lx = xN[i] + (a / L) * sw
      svg += `<line x1="${lx}" y1="${BY - 26}" x2="${lx}" y2="${BY}" stroke="${loadColor}" stroke-width="2" marker-end="url(#da)"/>`
      svg += `<text x="${lx}" y="${BY - 30}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="${loadColor}">${P}kN</text>`
    } else if (load_type === 'udl') {
      const n = Math.max(3, Math.floor(sw / 16))
      for (let k = 0; k <= n; k++) {
        const ax = xN[i] + (k / n) * sw
        svg += `<line x1="${ax}" y1="${BY - 22}" x2="${ax}" y2="${BY}" stroke="${loadColor}" stroke-width="1.5" marker-end="url(#da)"/>`
      }
      svg += `<line x1="${xN[i]}" y1="${BY - 22}" x2="${xN[i+1]}" y2="${BY - 22}" stroke="${loadColor}" stroke-width="1.5"/>`
      svg += `<text x="${(xN[i]+xN[i+1])/2}" y="${BY - 27}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="${loadColor}">${P}kN/m</text>`
    } else if (load_type === 'tri_inc') {
      const n = Math.max(4, Math.floor(sw / 14))
      for (let k = 1; k <= n; k++) {
        const ax = xN[i] + (k / n) * sw
        const ah = 6 + (k / n) * 16
        svg += `<line x1="${ax}" y1="${BY - ah}" x2="${ax}" y2="${BY}" stroke="#14b8a6" stroke-width="1.5" marker-end="url(#da)"/>`
      }
      svg += `<line x1="${xN[i]}" y1="${BY}" x2="${xN[i+1]}" y2="${BY - 22}" stroke="#14b8a6" stroke-width="1.5"/>`
      svg += `<text x="${xN[i+1] - 4}" y="${BY - 28}" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="10" fill="#14b8a6">w₀=${P}</text>`
    } else if (load_type === 'tri_dec') {
      const n = Math.max(4, Math.floor(sw / 14))
      for (let k = 0; k < n; k++) {
        const ax = xN[i] + (k / n) * sw
        const ah = 22 - (k / n) * 16
        svg += `<line x1="${ax}" y1="${BY - ah}" x2="${ax}" y2="${BY}" stroke="#a855f7" stroke-width="1.5" marker-end="url(#da)"/>`
      }
      svg += `<line x1="${xN[i]}" y1="${BY - 22}" x2="${xN[i+1]}" y2="${BY}" stroke="#a855f7" stroke-width="1.5"/>`
      svg += `<text x="${xN[i] + 4}" y="${BY - 28}" text-anchor="start" font-family="JetBrains Mono,monospace" font-size="10" fill="#a855f7">w₀=${P}</text>`
    } else if (load_type === 'moment') {
      const lx = xN[i] + (a / L) * sw
      svg += `<path d="M${lx - 12},${BY - 16} A13 13 0 1 1 ${lx + 12},${BY - 16}" fill="none" stroke="${loadColor}" stroke-width="2" marker-end="url(#da)"/>`
      svg += `<text x="${lx}" y="${BY - 34}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="${loadColor}">${P}kN·m</text>`
    }
  }

  // 支承符號
  for (let i = 0; i < nNodes; i++) {
    const x = xN[i], sy = BY + BH
    const sup = supports[i] || 'free'

    if (sup === 'fixed') {
      svg += `<rect x="${x - 6}" y="${sy}" width="12" height="22" fill="${supColor}"/>`
      for (let k = 0; k < 3; k++) {
        svg += `<line x1="${x - 12}" y1="${sy + k*8 + 3}" x2="${x - 6}" y2="${sy + k*8}" stroke="${supColor}" stroke-width="1.2"/>`
        svg += `<line x1="${x + 6}"  y1="${sy + k*8}" x2="${x + 12}" y2="${sy + k*8 + 3}" stroke="${supColor}" stroke-width="1.2"/>`
      }
    } else if (sup === 'pin') {
      svg += `<polygon points="${x},${sy} ${x-10},${sy+18} ${x+10},${sy+18}" fill="none" stroke="${supColor}" stroke-width="1.8"/>`
      svg += `<line x1="${x - 13}" y1="${sy+18}" x2="${x + 13}" y2="${sy+18}" stroke="${supColor}" stroke-width="1.5"/>`
    } else if (sup === 'roller') {
      svg += `<polygon points="${x},${sy} ${x-9},${sy+14} ${x+9},${sy+14}" fill="none" stroke="${supColor}" stroke-width="1.8"/>`
      svg += `<circle cx="${x - 6}" cy="${sy+19}" r="3" fill="none" stroke="${supColor}" stroke-width="1.5"/>`
      svg += `<circle cx="${x + 6}" cy="${sy+19}" r="3" fill="none" stroke="${supColor}" stroke-width="1.5"/>`
    }

    svg += `<text x="${x}" y="${H - 18}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#8899bb">${NL[i]}</text>`
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, minWidth: 300 }}
      dangerouslySetInnerHTML={{ __html: `<defs>${defs}</defs>${svg}` }} />
  )
}
