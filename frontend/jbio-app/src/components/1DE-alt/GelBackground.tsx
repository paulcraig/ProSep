import React from "react";

type Props = {
    ticks: number;
    wellsCount: number;
    slabW: number;
    slabH: number;
    wellW: number;
    wellH: number;
    totalH: number;
    anodeT: number;

    zoom: number;
    anchor: number;

    acrylamidePct: number;
};

export default function GelBackground ({
    ticks,
    wellsCount,
    slabW,
    slabH,
    wellW,
    wellH,
    totalH,
    anodeT,
    zoom,
    anchor,
    acrylamidePct,
}: Props) {
    const minTickH = 20;
    const subTicks = 3;

    const valueToY = React.useCallback(
        (v: number) => {
            const norm = v / ticks;
            const a = anchor;
            let mapped;

            if (norm <= a) {
                mapped = a * Math.pow(norm / Math.max(a, 1e-9), zoom);
            } else {
                mapped = 1 - (1 - a) * Math.pow((1 - norm) / Math.max(1 - a, 1e-9), zoom);
            }

            return wellH * 2 + mapped * (slabH - wellH);
        },
        [ticks, anchor, zoom, wellH, slabH]
    );

    const buildWells = React.useCallback(() => {
        let fill = `M0,${wellH}`;
        let x = 0;

        for (let i = 0; i < wellsCount; i++) {
            fill += ` H${x + wellW} V${wellH + wellH} H${x + 2 * wellW} V${wellH}`;
            x += 2 * wellW;
        }

        fill += ` H${x + wellW} V${wellH + slabH} H0 Z`;
        let top = `M0,${wellH} H${wellW}`;

        for (let i = 0; i < wellsCount; i++) {
            const rightX = (2 * i + 2) * wellW;
            const nextT = (2 * i + 3) * wellW;
            top += ` V${wellH + wellH} H${rightX} V${wellH} H${nextT}`;
        }

        const sides = `M0,${wellH} V${wellH + slabH} H${slabW} V${wellH}`;
        return { fill, top, sides };
    }, [wellH, wellW, wellsCount, slabH, slabW]);

    const { fill: pathFill, top: pathTop, sides: pathSides } = React.useMemo(
        () => buildWells(),
        [buildWells]
    );

    const axisTicks = React.useMemo(() => {
        let lastTickY = -Infinity;
    
        return Array.from({ length: ticks + 1 }).map((_, i) => {
            const y = valueToY(i);
            const dx = y - lastTickY;
        
            let opacity = Math.pow(Math.max(0, Math.min(1, dx / minTickH)), 2);
        
            if (i === 0 || i === ticks) {
                opacity = 1;
                lastTickY = y;
            } else if (opacity > 0.05) {
                lastTickY = y;
            }
        
            if (i !== ticks) {
                const yN = valueToY(ticks);
                const fadeNearN = Math.pow(Math.max(0, Math.min(1, (yN - y) / minTickH)), 2);
        
                opacity = Math.min(opacity, fadeNearN);
            }
        
            return (
                <g key={`axis-${i}`} opacity={opacity}>
                    <line
                        x1={0} y1={y} x2={slabW} y2={y}
                        stroke={(i === 0 || i === ticks) ? 'var(--sub-text)' : 'var(--text)'}
                        strokeWidth={i === 0 || i === ticks ? '0.05rem' : '0.125rem'}
                    />
                    <line
                        x1={-20} y1={y} x2={0} y2={y}
                        stroke='var(--accent)'
                        strokeWidth='0.125rem'
                    />
                    <text
                        x={-30} y={y + 6}
                        fill='var(--text)'
                        textAnchor='end'
                        fontWeight='bold'
                    >
                        {i}
                    </text>

                    {i < ticks &&
                        [1, 2].map(j => {
                        const subY = valueToY(i + j / subTicks)
                        const subOpacity = Math.pow(Math.max(0, Math.min(1, (subY - y) / (minTickH / 2))), 2)
                        const fadeNearN = Math.pow(Math.max(0, Math.min(1, valueToY(ticks) - subY / (minTickH / 2))), 2)
            
                        return (
                            <g key={`sub-${i}-${j}`} opacity={subOpacity * fadeNearN}>
                                <line
                                    x1={0} y1={subY} x2={slabW} y2={subY}
                                    stroke='var(--sub-text)'
                                    strokeWidth='0.05rem'
                                />
                                <line
                                    x1={-12} y1={subY} x2={0} y2={subY}
                                    stroke='var(--accent)'
                                    strokeWidth='0.05rem'
                                />
                            </g>
                        );
                    })}
                </g>
            );
        });
    }, [ticks, zoom, anchor, totalH, wellsCount, slabW, valueToY]);

    const dots = React.useMemo(() => {
        const pct = Math.min(15, Math.max(7.5, acrylamidePct));
        const poreSize = 40 / Math.sqrt(pct);
    
        const spacingX = wellW / (Math.max(2, Math.round((wellW * pct) / 120)));
        const opacity = Math.max(0, 0.25 * (1 - (zoom - 1)));
    
        const slabDots = Array.from({ length: ticks }).flatMap((_, i) =>
            Array.from({ length: subTicks }).flatMap((__, sub) => {
                const cols = Math.floor(slabW / spacingX);
        
                return Array.from({ length: cols }).map((__, j) => (
                    <circle
                        key={`band-dot-${i}-${sub}-${j}`}
                        fill='var(--sub-text)'
                        opacity={opacity}
            
                        cx={j * spacingX + spacingX / 2}
                        cy={valueToY(i + (sub + 0.5) / subTicks)}
                        r={poreSize * 0.25}
                    />
                ));
            })
        );
    
        const y0 = valueToY(0);
        const y1 = valueToY(1);
    
        const rowPadPx = Math.max(1, (y1 - y0) / subTicks);
        const totalPx = y0 - wellH;
    
        const rows = Math.max(2, Math.floor(totalPx / rowPadPx));
        const cols = Math.floor(slabW / spacingX) + 1;
    
        const wellDots = Array.from({ length: rows }).flatMap((_, rIdx) => {
            const y = (y0 - totalPx) + (rIdx + 0.75) * rowPadPx;
        
            if (y > y0) return [];
        
            return Array.from({ length: cols }).map((__, j) => (
                <circle
                    key={`well-dot-${rIdx}-${j}`}
                    fill='var(--sub-text)'
                    opacity={opacity}
                    
                    cx={j * spacingX + spacingX / 2}
                    cy={y} 
                    r={poreSize * 0.25}
                />
            ));
        });
    
        return [...wellDots, ...slabDots];
    }, [acrylamidePct, ticks, zoom, anchor, wellsCount, slabW, wellW, wellH, valueToY]);

    return (
        <g className="acrylamide-slab">
            <path d={pathFill} fill="var(--sub-background)" />
            <defs>
                <clipPath id="gel-clip">
                    <path d={pathFill}/>
                </clipPath>
            </defs>

            <g opacity="0.6" clipPath="url(#gel-clip)">
                {dots}
            </g>

            <g className="axis">{axisTicks}</g>

            <path d={pathSides} className="gel-border" />
            <path d={pathTop} className="gel-border" />
        </g>
    );
}