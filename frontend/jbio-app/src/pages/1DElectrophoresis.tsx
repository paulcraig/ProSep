import React, { useState } from 'react'
import './1DElectrophoresis.css'

import blackWire from '../assets/electrophoresis/blackwire.png'
import redWire from '../assets/electrophoresis/redwire.png'


interface ElectrophoresisProps {
  ticks?: number
  wells?: number
  voltage?: number
  acrylamide?: number
}


const OneDE: React.FC<ElectrophoresisProps> = ({
  ticks = 6,
  wells = 2,
  voltage = 50,
  acrylamide = 7.5,
}) => {

  const [zoom, setZoom] = useState(1)
  const [anchor, setAnchor] = useState(0.5)
  const [isDragging, setIsDragging] = useState(false)
  const [lastY, setwellWastY] = useState<number | null>(null)

  const minTickH = 20
  const totalH = 750
  const slabW = 525
  const wellH = 45
  const wireH = 25
  const wireW = 75
  const wireO = 10
  const buffH = 0.15 * totalH
  const anodeT = totalH - buffH
  const slabH = totalH - wellH - buffH
  const units = 2 * wells + 1
  const wellW = slabW / units

  let lastTickY = -Infinity


  const buildWells = () => {
    let fill = `M0,${wellH}`
    let x = 0

    for (let i = 0; i < wells; i++) {
      fill += ` H${x + wellW} V${wellH + wellH} H${x + 2 * wellW} V${wellH}`
      x += 2 * wellW
    }

    fill += ` H${x + wellW} V${wellH + slabH} H0 Z`
    let top = `M0,${wellH} H${wellW}`

    for (let i = 0; i < wells; i++) {
      const rightX = (2 * i + 2) * wellW
      const nextT = (2 * i + 3) * wellW
      top += ` V${wellH + wellH} H${rightX} V${wellH} H${nextT}`
    }

    const sides = `M0,${wellH} V${wellH + slabH} H${slabW} V${wellH}`
    return { fill, top, sides }
  }
  const { fill: pathFill, top: pathTop, sides: pathSides } = buildWells()

  
  const valueToY = (v: number) => {
    const norm = v / ticks
    const a = anchor
    let mapped

    if (norm <= a) {
      mapped = a * Math.pow(norm / Math.max(a, 1e-9), zoom)
    } else {
      mapped = 1 - (1 - a) * Math.pow((1 - norm) / Math.max(1 - a, 1e-9), zoom)
    }
    return wellH + wellH + mapped * (slabH - wellH)
  }


  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const container = e.currentTarget.closest('.gel-container')

    if (!container || !container.contains(e.target as Node)) return

    const rect = e.currentTarget.getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const slabTop = wellH + wellH
    const slabBottom = anodeT

    if (mouseY < slabTop || mouseY > slabBottom) return

    const frac = (mouseY - slabTop) / (slabH - wellH)
    const newAnchor = Math.max(0, Math.min(1, frac))
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9

    setZoom(z => Math.min(10, Math.max(1, z * zoomFactor)))
    setAnchor(newAnchor)
  }


  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true)
    setwellWastY(e.clientY)
  }


  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || lastY === null) return

    const dy = e.clientY - lastY

    setwellWastY(e.clientY)

    const normShift = dy / (slabH - wellH)

    setAnchor(a => Math.max(0, Math.min(1, a - normShift)))
  }

  
  const handleMouseUp = () => {
    setIsDragging(false)
    setwellWastY(null)
  }


  const axisTicks = Array.from({ length: ticks + 1 }).map((_, i) => {
    const y = valueToY(i)
    const dist = y - lastTickY
    let opacity = Math.pow(Math.max(0, Math.min(1, dist / minTickH)), 2)

    if (i === 0 || i === ticks) {
      opacity = 1
      lastTickY = y
    } else if (opacity > 0.05) {
      lastTickY = y
    }

    if (i !== ticks) {
      const yN = valueToY(ticks)
      const distToN = yN - y
      const fadeNearN = Math.pow(Math.max(0, Math.min(1, distToN / minTickH)), 2)

      opacity = Math.min(opacity, fadeNearN)
    }

    return (
      <g key={`axis-${i}`} opacity={opacity}>
        <line
          x1={0}
          y1={y}
          x2={slabW}
          y2={y}
          stroke={(i === 0 || i === ticks) ? 'var(--sub-text)' : 'var(--text)'}
          strokeWidth={i === 0 || i === ticks ? '0.05rem' : '0.125rem'}
        />
        <line x1={-20} y1={y} x2={0} y2={y} stroke='var(--accent)' strokeWidth='0.125rem' />
        <text
          x={-30}
          y={y + 6}
          fontSize='14'
          fontFamily='sans-serif'
          fill='var(--text)'
          textAnchor='end'
          fontWeight='bold'
        >
          {i}
        </text>
        {i < ticks &&
          [1, 2].map(j => {
            const subY = valueToY(i + j / 3)
            const subDist = subY - y
            const subOpacity = Math.pow(Math.max(0, Math.min(1, subDist / (minTickH / 2))), 2)
            const yN = valueToY(ticks)
            const distToN = yN - subY
            const fadeNearN = Math.pow(Math.max(0, Math.min(1, distToN / (minTickH / 2))), 2)
            return (
              <g key={`sub-${i}-${j}`} opacity={subOpacity * fadeNearN}>
                <line x1={0} y1={subY} x2={slabW} y2={subY} stroke='var(--sub-text)' strokeWidth='0.05rem' />
                <line x1={-12} y1={subY} x2={0} y2={subY} stroke='var(--accent)' strokeWidth='0.05rem' />
              </g>
            )
          })}
      </g>
    )
  })


  const renderDots = () => {
    const pct = Math.min(15, Math.max(7.5, acrylamide))
    const poreSize = 40 / Math.sqrt(pct)

    const dotsPerWell = Math.max(2, Math.round((wellW * pct) / 120))
    const spacingX = wellW / dotsPerWell

    const opacity = Math.max(0, 0.25 * (1 - (zoom - 1)))
    const subsPerTick = 3

    const bandDots = Array.from({ length: ticks }).flatMap((_, i) =>
      Array.from({ length: subsPerTick }).flatMap((__, sub) => {
        const y = valueToY(i + (sub + 0.5) / subsPerTick)
        const cols = Math.floor(slabW / spacingX)

        return Array.from({ length: cols }).map((__, j) => (
          <circle
            key={`band-dot-${i}-${sub}-${j}`}
            cx={j * spacingX + spacingX / 2}
            cy={y}
            r={poreSize * 0.2}
            fill='var(--sub-text)'
            opacity={opacity}
          />
        ))
      })
    )

    const y0 = valueToY(0)
    const y1 = valueToY(1)

    const rowPadPx = Math.max(1, (y1 - y0) / subsPerTick)
    const totalPx = y0 - wellH

    const rows = Math.max(2, Math.floor(totalPx / rowPadPx))
    const cols = Math.floor(slabW / spacingX) + 1

    const wellDots = Array.from({ length: rows }).flatMap((_, rIdx) => {
      const y = (y0 - totalPx) + (rIdx + 0.75) * rowPadPx

      if (y > y0) return []

      return Array.from({ length: cols }).map((__, j) => (
        <circle
          key={`well-dot-${rIdx}-${j}`}
          cx={j * spacingX + spacingX / 2}
          cy={y}
          r={poreSize * 0.2}
          fill='var(--sub-text)'
          opacity={opacity}
        />
      ))
    })

    return [...wellDots, ...bandDots]
  }


  return (
    <div className='gel-wrapper'>
      <div className='gel-container'>
        <svg
          width={slabW + 160}
          height={totalH + 40}
          viewBox={`-60 0 ${slabW + 160} ${totalH + 40}`}
          className='gel-svg'
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: zoom === 1 ? 'default' : isDragging ? 'grabbing' : 'grab'
          }}
        >
          <line
            x1={slabW + wireW + wireO}
            y1={wellH}
            x2={slabW + wireW + wireO}
            y2={(totalH / 2) - 20}
            stroke='#191919'
            strokeWidth='0.75rem'
            strokeLinecap='round'
          />
          <line
            x1={slabW + wireW + wireO}
            y1={(totalH / 2) + 20}
            x2={slabW + wireW + wireO}
            y2={anodeT + wellH}
            stroke='#ff3636'
            strokeWidth='0.75rem'
            strokeLinecap='round'
          />
          <g>
            <line
              x1={slabW + wireW + wireO - 20}
              y1={(totalH / 2) - 20}
              x2={slabW + wireW + wireO + 20}
              y2={(totalH / 2) - 20}
              stroke='#191919'
              strokeWidth='0.75rem'
            />
            <line
              x1={slabW + wireW + wireO - 40}
              y1={(totalH / 2) + 20}
              x2={slabW + wireW + wireO + 40}
              y2={(totalH / 2) + 20}
              stroke='#ff3636'
              strokeWidth='0.75rem'
            />
            <text
              x={slabW + wireW + wireO}
              y={totalH / 2 + 5}
              textAnchor='middle'
              fontWeight='bold'
              fill='var(--text)'
            >
              {voltage}V
            </text>
          </g>

          <rect x={-20} width={slabW + 40} height={wellH * 2} fill='var(--highlight)' stroke='var(--accent)' strokeWidth='0.25rem' ry={5} rx={5} />
          <image href={blackWire} x={slabW + wireO} y={wellH - wireH / 2} height={wireH} width={wireW} preserveAspectRatio='xMidYMid meet' />
          <rect x={-20} y={anodeT} width={slabW + 40} height={wellH * 2} fill='var(--highlight)' stroke='var(--accent)' strokeWidth='0.25rem' ry={5} rx={5} />
          <text y={anodeT + wellH} className='noselect' fill='var(--sub-text)' textAnchor='start' alignmentBaseline='middle' fontWeight='bold'>
            {`Acrylamide ${acrylamide}%`}
          </text>
          <image href={redWire} x={slabW + wireO} y={anodeT + wellH - wireH / 2} height={wireH} width={wireW} preserveAspectRatio='xMidYMid meet' />

          <path d={pathFill} fill='var(--sub-background)' />
          <defs><clipPath id='gel-clip'><path d={pathFill} /></clipPath></defs>

          <g opacity='0.6' clipPath='url(#gel-clip)'>{renderDots()}</g>
          <g className='axis'>{axisTicks}</g>
          <path d={pathSides} className='gel-border' />
          <path d={pathTop} className='gel-border' />
        </svg>
      </div>
    </div>
  )
}

export default OneDE
