/* Dependency-free inline-SVG chart primitives, shared by index.html and allocator.html.
   No build step, no external libraries. Every function returns an SVG markup string;
   callers set it via `container.innerHTML = ...`. Colors/styling are always caller-supplied. */

function escapeSvgText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* points: [{ value: number|null, color, label }]
   options: { width, height, pointRadius, ariaLabel }
   A null value renders as a fixed-position neutral point in its own color; the connecting
   path breaks on either side of it rather than interpolating through a fabricated position. */
function sparkline(points, options) {
  options = options || {};
  const width = options.width || 240;
  const height = options.height || 60;
  const pointRadius = options.pointRadius || 3;
  const ariaLabel = options.ariaLabel || '';

  if (!Array.isArray(points) || points.length === 0) return '';

  const padding = pointRadius + 2;
  const n = points.length;
  const xAt = (i) => n === 1 ? width / 2 : padding + (i * (width - 2 * padding)) / (n - 1);

  const realValues = points.filter((p) => p.value !== null && p.value !== undefined).map((p) => p.value);
  const min = realValues.length ? Math.min(...realValues) : 0;
  const max = realValues.length ? Math.max(...realValues) : 0;
  const neutralY = height / 2;
  const yAt = (value) => {
    if (value === null || value === undefined) return neutralY;
    if (max === min) return neutralY;
    return padding + (1 - (value - min) / (max - min)) * (height - 2 * padding);
  };

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value), p }));

  const pathSegments = [];
  let run = [];
  coords.forEach((c, i) => {
    const isReal = c.p.value !== null && c.p.value !== undefined;
    if (isReal) {
      run.push(c);
    } else if (run.length) {
      pathSegments.push(run);
      run = [];
    }
  });
  if (run.length) pathSegments.push(run);

  const paths = pathSegments
    .filter((run) => run.length >= 2)
    .map((run) => {
      const d = run.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
      const strokeColor = run[0].p.color || '#333';
      return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="2" />`;
    })
    .join('');

  const circles = coords
    .map((c) => {
      const color = c.p.color || '#333';
      const title = c.p.label ? `<title>${escapeSvgText(c.p.label)}</title>` : '';
      return `<circle cx="${c.x}" cy="${c.y}" r="${pointRadius}" fill="${color}">${title}</circle>`;
    })
    .join('');

  const labelAttr = ariaLabel ? ` role="img" aria-label="${escapeSvgText(ariaLabel)}"` : '';
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}"${labelAttr}>${paths}${circles}</svg>`;
}

/* segments: [{ value, color, label }]
   options: { width, height, orientation: 'horizontal'|'vertical' }
   Renders one bar divided into proportional segments -- a breakdown of a whole, not a
   multi-bar comparison. */
function bar(segments, options) {
  options = options || {};
  const width = options.width || 240;
  const height = options.height || 24;
  const orientation = options.orientation || 'horizontal';

  if (!Array.isArray(segments) || segments.length === 0) return '';

  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}"></svg>`;

  let offset = 0;
  const rects = segments
    .map((s) => {
      const value = Number(s.value) || 0;
      const share = value / total;
      const color = s.color || '#333';
      const title = s.label ? `<title>${escapeSvgText(s.label)}</title>` : '';
      let rect;
      if (orientation === 'vertical') {
        const segHeight = share * height;
        const y = height - offset - segHeight;
        rect = `<rect x="0" y="${y}" width="${width}" height="${segHeight}" fill="${color}">${title}</rect>`;
        offset += segHeight;
      } else {
        const segWidth = share * width;
        rect = `<rect x="${offset}" y="0" width="${segWidth}" height="${height}" fill="${color}">${title}</rect>`;
        offset += segWidth;
      }
      return rect;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${rects}</svg>`;
}

/* segments: [{ value, color, label }]
   options: { width, height, innerRadiusRatio }
   Renders one donut divided into proportional annular-sector arcs. */
function donut(segments, options) {
  options = options || {};
  const width = options.width || 120;
  const height = options.height || 120;
  const innerRadiusRatio = options.innerRadiusRatio !== undefined ? options.innerRadiusRatio : 0.6;

  if (!Array.isArray(segments) || segments.length === 0) return '';

  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}"></svg>`;

  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(width, height) / 2;
  const innerR = outerR * innerRadiusRatio;

  const pointOnCircle = (r, angle) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle)
  });

  let startAngle = -Math.PI / 2;
  const arcs = segments
    .map((s) => {
      const value = Number(s.value) || 0;
      const share = value / total;
      const endAngle = startAngle + share * 2 * Math.PI;
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      const outerStart = pointOnCircle(outerR, startAngle);
      const outerEnd = pointOnCircle(outerR, endAngle);
      const innerStart = pointOnCircle(innerR, endAngle);
      const innerEnd = pointOnCircle(innerR, startAngle);
      const color = s.color || '#333';
      const title = s.label ? `<title>${escapeSvgText(s.label)}</title>` : '';
      const d = [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerStart.x} ${innerStart.y}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
        'Z'
      ].join(' ');
      startAngle = endAngle;
      return `<path d="${d}" fill="${color}">${title}</path>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${arcs}</svg>`;
}
