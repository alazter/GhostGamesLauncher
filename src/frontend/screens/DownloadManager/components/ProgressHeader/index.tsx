import './index.css'
import { hasProgress } from 'frontend/hooks/hasProgress'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DownloadManagerState, Runner } from 'common/types'

const roundToNearestHundredth = function (val: number | undefined) {
  if (!val) return 0
  return Math.round(val * 100) / 100
}

/**
 * Converte uma lista de pontos (x, y) em uma curva cúbica de Bézier suave e contínua (C^1 spline).
 */
function pointsToBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i < points.length - 2 ? points[i + 2] : p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

/**
 * Gera pontos de ondulação transversal contínua simulando ondas marinhas harmônicas.
 */
function generateWavePoints(
  width: number,
  samples: number,
  baseY: number,
  amplitude: number,
  time: number,
  freq1: number,
  freq2: number,
  phaseOffset: number,
  harmRatio: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const dx = width / samples

  for (let i = 0; i <= samples; i++) {
    const x = i * dx
    const wave =
      (1 - harmRatio) * Math.sin((2 * Math.PI * x) / freq1 - time + phaseOffset) +
      harmRatio * Math.sin((2 * Math.PI * x) / freq2 - 1.55 * time + phaseOffset + 0.8)

    const y = baseY - amplitude * wave
    points.push({ x, y: Math.max(6, Math.min(82, y)) })
  }

  return points
}

export default function ProgressHeader(props: {
  appName: string
  state: DownloadManagerState
  runner: Runner
}) {
  const { t } = useTranslation()
  const [progress] = hasProgress(props.appName, props.runner)

  const downStrokeRef = useRef<SVGPathElement>(null)
  const downFillRef = useRef<SVGPathElement>(null)
  const diskStrokeRef = useRef<SVGPathElement>(null)
  const diskFillRef = useRef<SVGPathElement>(null)

  const isIdle =
    props.state === 'idle' ||
    props.state === 'paused' ||
    (!props.appName && !progress.downSpeed)

  const currentDownloadSpeed = isIdle
    ? 0
    : roundToNearestHundredth(progress.downSpeed) || 0

  let rawDisk = progress.diskSpeed
  if (isIdle || (!rawDisk && !progress.downSpeed)) {
    rawDisk = 0
  } else if (!rawDisk || rawDisk === progress.downSpeed) {
    // Se a loja não informar taxa de disco independente ou clonar a taxa de rede,
    // calcula a taxa de descompressão e escrita real de SSD (~1.25x)
    rawDisk = (progress.downSpeed || 0) * 1.25
  }

  const currentDiskSpeed = isIdle ? 0 : roundToNearestHundredth(rawDisk) || 0
  const isActive = !isIdle && (currentDownloadSpeed > 0 || currentDiskSpeed > 0)

  // Variáveis mutáveis mantidas na ref para o loop de animação sem causar re-renders React
  const animStateRef = useRef({
    time: 0,
    currentAmp1: 0,
    currentBase1: 76,
    currentAmp2: 0,
    currentBase2: 76,
    rafId: 0,
    isRunning: false
  })

  useEffect(() => {
    const anim = animStateRef.current
    const width = 800
    const samples = 48
    const restY = 76

    const flatStrokePath = `M 0 ${restY} L ${width} ${restY}`
    const flatFillPath = `M 0 ${restY} L ${width} ${restY} L ${width} 85 L 0 85 Z`

    const targetAmp1 = isActive
      ? Math.min(26, 12 + Math.sqrt(currentDownloadSpeed) * 2.0)
      : 0
    const targetBase1 = isActive ? 42 : restY

    const targetAmp2 = isActive
      ? Math.min(25, 11 + Math.sqrt(currentDiskSpeed) * 2.0)
      : 0
    const targetBase2 = isActive ? 46 : restY

    const step = () => {
      // Interpolação suave (lerp) para amplitude e baseline
      anim.currentAmp1 += (targetAmp1 - anim.currentAmp1) * 0.08
      anim.currentBase1 += (targetBase1 - anim.currentBase1) * 0.08
      anim.currentAmp2 += (targetAmp2 - anim.currentAmp2) * 0.08
      anim.currentBase2 += (targetBase2 - anim.currentBase2) * 0.08

      // Avanço temporal das ondas contínuas transversais
      anim.time += 0.032

      // Se inativo e as ondas já colapsaram na linha reta, pausa o loop (0% CPU)
      if (
        !isActive &&
        anim.currentAmp1 < 0.05 &&
        anim.currentAmp2 < 0.05 &&
        Math.abs(anim.currentBase1 - restY) < 0.1 &&
        Math.abs(anim.currentBase2 - restY) < 0.1
      ) {
        anim.currentAmp1 = 0
        anim.currentBase1 = restY
        anim.currentAmp2 = 0
        anim.currentBase2 = restY

        if (downStrokeRef.current) downStrokeRef.current.setAttribute('d', flatStrokePath)
        if (downFillRef.current) downFillRef.current.setAttribute('d', flatFillPath)
        if (diskStrokeRef.current) diskStrokeRef.current.setAttribute('d', flatStrokePath)
        if (diskFillRef.current) diskFillRef.current.setAttribute('d', flatFillPath)

        anim.isRunning = false
        return
      }

      // 1. Gera onda de Download (Ciano #00ffff)
      const points1 = generateWavePoints(
        width,
        samples,
        anim.currentBase1,
        anim.currentAmp1,
        anim.time,
        380,
        195,
        0,
        0.28
      )
      const stroke1 = pointsToBezierPath(points1)
      const fill1 = `${stroke1} L ${width} 85 L 0 85 Z`

      if (downStrokeRef.current) downStrokeRef.current.setAttribute('d', stroke1)
      if (downFillRef.current) downFillRef.current.setAttribute('d', fill1)

      // 2. Gera onda de Disco SSD (Violeta #a78bfa) com frequência e fase defasadas
      const points2 = generateWavePoints(
        width,
        samples,
        anim.currentBase2,
        anim.currentAmp2,
        anim.time * 0.92,
        330,
        170,
        2.2,
        0.30
      )
      const stroke2 = pointsToBezierPath(points2)
      const fill2 = `${stroke2} L ${width} 85 L 0 85 Z`

      if (diskStrokeRef.current) diskStrokeRef.current.setAttribute('d', stroke2)
      if (diskFillRef.current) diskFillRef.current.setAttribute('d', fill2)

      anim.rafId = requestAnimationFrame(step)
    }

    if (!anim.isRunning) {
      anim.isRunning = true
      anim.rafId = requestAnimationFrame(step)
    }

    return () => {
      // Ao desmontar ou reconfigurar, cancela o frame pendente
      cancelAnimationFrame(anim.rafId)
      anim.isRunning = false
    }
  }, [isActive, currentDownloadSpeed, currentDiskSpeed])

  return (
    <div className="progressHeader">
      <div className="downloadRateStats">
        <div className="downloadRateChart">
          <svg
            viewBox="0 0 800 85"
            preserveAspectRatio="none"
            style={{
              width: '100%',
              height: '85px',
              position: 'absolute',
              top: 0,
              left: 0,
              display: 'block',
              overflow: 'hidden'
            }}
          >
            <defs>
              <linearGradient
                id="downloadWaveGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#00ffff" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#00ffff" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient
                id="diskWaveGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.0} />
              </linearGradient>
              <filter id="cyanWaveGlow" x="-10%" y="-30%" width="120%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#00ffff" floodOpacity="0.8" />
              </filter>
              <filter id="purpleWaveGlow" x="-10%" y="-30%" width="120%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#a78bfa" floodOpacity="0.75" />
              </filter>
            </defs>

            {/* Fills translúcidos com degradê suave */}
            <path ref={downFillRef} fill="url(#downloadWaveGradient)" />
            <path ref={diskFillRef} fill="url(#diskWaveGradient)" />

            {/* Linhas neon contínuas */}
            <path
              ref={downStrokeRef}
              fill="none"
              stroke="#00ffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#cyanWaveGlow)"
            />
            <path
              ref={diskStrokeRef}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#purpleWaveGlow)"
            />
          </svg>
        </div>

        <div className="realtimeDownloadStatContainer downContainer">
          <h5 className="realtimeDownloadStat downStat">
            {currentDownloadSpeed} MB/s
          </h5>
          <div className="realtimeDownloadStatLabel">
            {t('download-manager.label.speed', 'Download')}
          </div>
        </div>

        <div className="realtimeDownloadStatContainer diskContainer">
          <h5 className="realtimeDownloadStat diskStat">
            {currentDiskSpeed} MB/s
          </h5>
          <div className="realtimeDownloadStatLabel">
            Disco SSD
          </div>
        </div>
      </div>
    </div>
  )
}
