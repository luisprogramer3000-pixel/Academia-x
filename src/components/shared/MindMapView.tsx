export interface MindMapData {
  center: string;
  branches: Array<{ label: string; children: string[] }>;
}

interface MindMapViewProps {
  data: MindMapData;
  primaryColor?: string;
}

/**
 * Dibuja el mapa mental como SVG.
 *
 * Se genera en el servidor y sin librerías de gráficos a propósito: un mapa
 * mental de una clase tiene 3-5 ramas, no necesita motor de layout, y así
 * funciona igual en el editor, en el campus y dentro del PDF de la lección.
 */
export function MindMapView({ data, primaryColor = "#6366F1" }: MindMapViewProps) {
  const branches = (data.branches || []).filter((b) => b?.label).slice(0, 6);
  if (!data?.center || branches.length === 0) return null;

  // Alto proporcional al contenido: cada rama ocupa una fila con sus hijas
  const ROW_HEIGHT = 92;
  const height = Math.max(240, branches.length * ROW_HEIGHT + 40);
  const width = 720;
  const centerX = 150;
  const centerY = height / 2;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label={`Mapa mental de ${data.center}`}
      >
        {branches.map((branch, i) => {
          const y = 40 + i * ROW_HEIGHT + ROW_HEIGHT / 2;
          const branchX = 300;
          return (
            <g key={i}>
              {/* Curva del centro a la rama */}
              <path
                d={`M ${centerX + 95} ${centerY} C ${centerX + 160} ${centerY}, ${branchX - 60} ${y}, ${branchX} ${y}`}
                fill="none"
                stroke={primaryColor}
                strokeWidth={2}
                opacity={0.55}
              />
              <rect
                x={branchX}
                y={y - 16}
                width={165}
                height={32}
                rx={8}
                fill={primaryColor}
                opacity={0.16}
                stroke={primaryColor}
                strokeOpacity={0.5}
              />
              <text
                x={branchX + 12}
                y={y + 5}
                fontSize={13}
                fontWeight={600}
                fill="currentColor"
                className="text-slate-100"
              >
                {branch.label.length > 22 ? `${branch.label.slice(0, 21)}…` : branch.label}
              </text>

              {/* Ideas hijas */}
              {(branch.children || []).slice(0, 4).map((child, j) => {
                const childY = y - 18 + j * 19;
                return (
                  <g key={j}>
                    <line
                      x1={branchX + 165}
                      y1={y}
                      x2={branchX + 195}
                      y2={childY}
                      stroke={primaryColor}
                      strokeWidth={1}
                      opacity={0.35}
                    />
                    <circle cx={branchX + 198} cy={childY} r={2.5} fill={primaryColor} opacity={0.8} />
                    <text x={branchX + 207} y={childY + 4} fontSize={11} fill="currentColor" className="text-slate-300">
                      {child.length > 34 ? `${child.slice(0, 33)}…` : child}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Nodo central, dibujado al final para quedar por encima de las curvas */}
        <rect
          x={centerX - 95}
          y={centerY - 28}
          width={190}
          height={56}
          rx={14}
          fill={primaryColor}
          opacity={0.92}
        />
        <text
          x={centerX}
          y={centerY + 5}
          fontSize={14}
          fontWeight={700}
          fill="#ffffff"
          textAnchor="middle"
        >
          {data.center.length > 24 ? `${data.center.slice(0, 23)}…` : data.center}
        </text>
      </svg>
    </div>
  );
}
