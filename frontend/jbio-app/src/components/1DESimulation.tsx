import React, { useState } from 'react'
import './1DESimulation.css'

import blackWire from '../assets/electrophoresis/blackwire.png'
import redWire from '../assets/electrophoresis/redwire.png'

import { Select, MenuItem, Button, Chip } from '@mui/material'

import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ClearAllIcon from '@mui/icons-material/ClearAll';


const standards = [
  { name: "B-Galactosidase", molecularWeight: 116250, migrationDistance: 0, color: "#4dd0e1", id_num: "6X1Q", id_str: "pdb" },
  { name: "Phosphorylase B", molecularWeight: 97400, migrationDistance: 0, color: "#d3e24aff", id_num: "3LQ8", id_str: "pdb" },
  { name: "Serum Albumin", molecularWeight: 66200, migrationDistance: 0, color: "#3d98c1ff", id_num: "1AO6", id_str: "pdb" },
  { name: "Ovalbumin", molecularWeight: 45000, migrationDistance: 0, color: "#f06292", id_num: "1OVA", id_str: "pdb" },
  { name: "Carbonic Anhydrase", molecularWeight: 29000, migrationDistance: 0, color: "#b8de7cff", id_num: "1CA2", id_str: "pdb" },
  { name: "Trypsin Inhibitor", molecularWeight: 20100, migrationDistance: 0, color: "#5c6bc0", id_num: "2PTC", id_str: "pdb" },
  { name: "Lysozyme", molecularWeight: 14400, migrationDistance: 0, color: "#81c784", id_num: "6LYZ", id_str: "pdb" },
  { name: "Aprotinin", molecularWeight: 6500, migrationDistance: 0, color: "#e57373", id_num: "1AAP", id_str: "pdb" }
];

interface ElectrophoresisProps {
  ticks?: number
  wells?: number
  voltage?: number
  acrylamide?: number
}


const OneDESim: React.FC<ElectrophoresisProps> = ({
  ticks = 6,
  wells = 3,
  voltage = 50,
  acrylamide = 7.5,
}) => {
  const [wellsCount, setWellsCount] = useState(wells)
  const [voltageAmt, setVoltageAmt] = useState(voltage)
  const [acrylamidePct, setAcrylamidePct] = useState(acrylamide)

  const [zoom, setZoom] = useState(1)
  const [anchor, setAnchor] = useState(0.5)
  const [isDragging, setIsDragging] = useState(false)
  const [lastY, setwellWastY] = useState<number | null>(null)

  const [hasStarted, setHasStarted] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [showChart, setShowChart] = useState(false)

  const timerRef = React.useRef<number | null>(null)
  const [selectedStandards, setSelectedStandards] = useState<typeof standards[number][]>(standards)
  const [positions, setPositions] = useState<Record<number, Record<string, number>>>(() =>
    Object.fromEntries(
      Array.from({ length: wellsCount }).map((_, wi) => [
        wi, Object.fromEntries(standards.map(p => [p.id_num, 0]))
      ])
    )
  )

  const minTickH = 20
  const totalH = 700
  const slabW = 575
  const wellH = 45
  const wireH = 25
  const wireW = 75
  const wireO = 10
  const buffH = 0.15 * totalH
  const anodeT = totalH - buffH
  const slabH = totalH - wellH - buffH
  const units = 2 * wellsCount + 1
  const wellW = slabW / units
  const bandW = wellW * 0.8
  const bandH = wellH * 0.2

  let lastTickY = -Infinity


  const toggleProtein = (protein: typeof standards[number]) => {
    setSelectedStandards(prev =>
      prev.some(p => p.id_num === protein.id_num)
        ? prev.filter(p => p.id_num !== protein.id_num)
        : [...prev, protein]
    )
  }


  const getFormula = (pct: number) => {
    const a = -0.55 - 0.01 * pct
    const b = 2.9 + 0.05 * pct
    return (logMW: number) => a * logMW + b
  }


  const handleStop = () => {
    setIsRunning(false)

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  
  const handleToggleRun = () => {
    if (isRunning) {
      handleStop()
    } else {
      setIsRunning(true)
      setHasStarted(true)

      timerRef.current = window.setInterval(() => {
        setPositions(prev => {
          const updated: typeof prev = { ...prev }

          for (const [wi, wellProteins] of Object.entries(prev)) {
            const idx = Number(wi)
            updated[idx] = { ...wellProteins }

            for (const protein of selectedStandards) {
              const current = wellProteins[protein.id_num]
              const maxDist = slabH + wellH / 2

              // Target migration distance (Rf × gel height)
              const logMW = Math.log10(protein.molecularWeight)
              const rf = getFormula(acrylamidePct)(logMW)
              const target = Math.min(rf * maxDist, maxDist)

              // Speed proportional to voltage
              const baseDur = 10
              const duration = baseDur * (50 / voltageAmt)
              const step = (target - current) / (duration * 50)

              updated[idx][protein.id_num] = Math.min(current + step, target)
            }
          }
          return updated
        })
      }, 10) // ~100 fps
    }
  }


  const handlePlot = () => setShowChart(prev => !prev)


  const handleReset = () => {
    handleStop()
    setHasStarted(false)

    setPositions(Object.fromEntries(
      Array.from({ length: wellsCount }).map((_, wi) => [
        wi,
        Object.fromEntries(standards.map(p => [p.id_num, 0]))
      ])
    ))
  }

  const handleClear = () => {
    setSelectedStandards(standards)
    handleReset()
  }


  const addWell = (e: React.MouseEvent) => {
    e.stopPropagation()
    setWellsCount(w => Math.min(6, w + 1))
  }


  const removeWell = (e: React.MouseEvent) => {
    e.stopPropagation()
    setWellsCount(w => Math.max(2, w - 1))
  }


  const buildWells = () => {
    let fill = `M0,${wellH}`
    let x = 0

    for (let i = 0; i < wellsCount; i++) {
      fill += ` H${x + wellW} V${wellH + wellH} H${x + 2 * wellW} V${wellH}`
      x += 2 * wellW
    }

    fill += ` H${x + wellW} V${wellH + slabH} H0 Z`
    let top = `M0,${wellH} H${wellW}`

    for (let i = 0; i < wellsCount; i++) {
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
    const container = e.currentTarget.querySelector('.acrylamide-slab');

    if (!container || !container.contains(e.target as Node)) return

    const rect = e.currentTarget.getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const slabTop = wellH + wellH
    const slabBottom = anodeT

    if (mouseY < slabTop || mouseY > slabBottom) return

    const frac = (mouseY - slabTop) / (slabH - wellH)
    const newAnchor = Math.max(0, Math.min(1, frac))
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9

    setZoom(z => {
      const newZoom = Math.min(5, Math.max(1, z * zoomFactor))

      if (newZoom === z) return z
      if (newZoom > z) setAnchor(newAnchor)
        
      return newZoom
    })
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
          fontSize='14px'
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
    const pct = Math.min(15, Math.max(7.5, acrylamidePct))
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
            r={poreSize * 0.25}
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
          r={poreSize * 0.25}
          fill='var(--sub-text)'
          opacity={opacity}
        />
      ))
    })

    return [...wellDots, ...bandDots]
  }


  return (
    <div className='gel-wrapper'>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          paddingLeft: '3.75rem',
          paddingBottom: '1rem',
          fontSize: '14px',
          width: slabW
        }}
      >
        {[
            { 
              label: isRunning ? 'Pause' : hasStarted ? 'Resume' : 'Start',
              icon: isRunning ? <StopIcon /> : <PlayArrowIcon />,
              onClick: handleToggleRun
            },
            { label: 'Plot',  icon: <InsertChartIcon />, onClick: handlePlot },
            { label: 'Reset', icon: <RestartAltIcon />,  onClick: handleReset },
            { label: 'Clear', icon: <ClearAllIcon />,    onClick: handleClear },
          ].map(btn => (
            <Button
              key={btn.label}
              onClick={btn.onClick}
              variant='contained'
              startIcon={btn.icon}
              sx={{
                '&:hover': { backgroundColor: 'var(--accent)' },
                backgroundColor: 'var(--highlight)',
                textTransform: 'none',
                color: 'var(--text)'
              }}
            >
              {btn.label}
            </Button>
        ))}
      </div>

      {/* Simulation */}
      <div className='gel-container'>
        <svg
          width={slabW * 1.4}
          height={totalH}
          viewBox={`-60 0 ${slabW * 1.4} ${totalH}`}
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
            <foreignObject
              x={slabW + wireW + wireO - 48}
              y={totalH / 2 - 14}
              width={96}
              height={28}
            >
              <Select
                variant='standard'
                value={voltageAmt}
                onChange={(e) => setVoltageAmt(Number(e.target.value))}
                sx={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: 'var(--text)',
                  '& .MuiSelect-icon': { color: 'var(--text)' },
                  paddingLeft: '1.75rem'
                }}
              >
                {[50, 100, 150, 200].map(v => ( <MenuItem key={v} value={v}>{v}V</MenuItem> ))}
              </Select>
            </foreignObject>
          </g>

          <rect x={-20} width={slabW + 40} height={wellH * 2} fill='var(--highlight)' stroke='var(--accent)' strokeWidth='0.25rem' ry={5} rx={5} />
          <image href={blackWire} x={slabW + wireO} y={wellH - wireH / 2} height={wireH} width={wireW} preserveAspectRatio='xMidYMid meet' />
          <rect x={-20} y={anodeT} width={slabW + 40} height={wellH * 2} fill='var(--highlight)' stroke='var(--accent)' strokeWidth='0.25rem' ry={5} rx={5} />
          <foreignObject x={0} y={anodeT + wellH - 12} width={160} height={24}>
            <Select
              variant='standard'
              value={acrylamidePct}
              onChange={(e) => setAcrylamidePct(Number(e.target.value))}
              sx={{
                fontWeight: 'bold',
                fontSize: '14px',
                color: 'var(--sub-text)',
                '& .MuiSelect-icon': { color: 'var(--sub-text)' },
              }}
            >
              {[7.5,10,12,15].map(a => ( <MenuItem key={a} value={a}>Acrylamide {a}%</MenuItem> ))}
            </Select>
          </foreignObject>
          <image href={redWire} x={slabW + wireO} y={anodeT + wellH - wireH / 2} height={wireH} width={wireW} preserveAspectRatio='xMidYMid meet' />

          <g className="acrylamide-slab">
            <path d={pathFill} fill='var(--sub-background)' />
            <defs><clipPath id='gel-clip'><path d={pathFill} /></clipPath></defs>

            <g opacity='0.6' clipPath='url(#gel-clip)'>{renderDots()}</g>
            <g className='axis'>{axisTicks}</g>
            <path d={pathSides} className='gel-border' />
            <path d={pathTop} className='gel-border' />
          </g>

          <g className='well-btn' style={{cursor:'pointer'}} transform={`translate(${wellW/2},${wellH*1.5})`} onClick={removeWell}>
            <circle r={12} />
            <line x1={-4} y1={0} x2={4} y2={0} stroke='var(--text)' strokeWidth={2} strokeLinecap='round' />
            <title>Remove well</title>
          </g>

          <g className='well-btn' style={{cursor:'pointer'}} transform={`translate(${slabW-wellW/2},${wellH*1.5})`} onClick={addWell}>
            <circle r={12} />
            <line x1={-4} y1={0} x2={4} y2={0} stroke='var(--text)' strokeWidth={2} strokeLinecap='round' />
            <line x1={0} y1={-4} x2={0} y2={4} stroke='var(--text)' strokeWidth={2} strokeLinecap='round' />
            <title>Add well</title>
          </g>

          <g className="standards-well">
            {selectedStandards.map((protein, i) => {
              return (
                <rect
                  key={protein.id_num}
                  x={wellW + ((wellW - bandW) / 2)}
                  y={wellH + ((wellH + bandH) / 2) + (positions[0]?.[protein.id_num] ?? 0)}
                  width={bandW}
                  height={bandH}
                  fill={protein.color}
                  stroke="black"
                  strokeWidth={0.5}
                  rx={3}
                  ry={3}
                >
                  <title>{protein.name}</title>
                </rect>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Proteins */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0.5rem',
        width: slabW,
        paddingLeft: '3.75rem'
      }}>
        {standards.map(protein => {
          const isSelected = selectedStandards.some(p => p.id_num === protein.id_num)
          return (
            <Chip
              key={protein.id_num}
              label={protein.name}
              onClick={() => toggleProtein(protein)}
              sx={{
                backgroundColor: isSelected ? protein.color : 'var(--highlight)',
                color: 'var(--text)',
                fontWeight: 'bold'
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export default OneDESim
