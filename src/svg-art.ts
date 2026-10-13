export type ArtBox = readonly [x: number, y: number, width: number, height: number];
const SVG = 'http://www.w3.org/2000/svg';
const frames = new WeakMap<Element, { root: SVGGElement; matrix?: DOMMatrix; inverse?: DOMMatrix; transform?: string }>();

/** Map an exported artboard into the asset's stable game-space rectangle. */
export function viewBoxMatrix(viewBox: string | null, target: ArtBox) {
  const values = viewBox === null ? [...target] : viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
    throw new Error(`Invalid SVG viewBox: ${viewBox}`);
  }
  const [x, y, width, height] = values;
  const a = target[2] / width, d = target[3] / height;
  return { a, d, e: target[0] - x * a, f: target[1] - y * d };
}
const group = () => document.createElementNS(SVG, 'g');
function presentation(source: Element, destination: Element) {
  for (const attribute of Array.from(source.attributes)) {
    if (!['id', 'xmlns', 'version', 'viewBox', 'width', 'height', 'x', 'y', 'overflow', 'preserveAspectRatio'].includes(attribute.name)) {
      destination.setAttribute(attribute.name, attribute.value);
    }
  }
}
export function cloneArtwork(source: Element, target: ArtBox): SVGGElement {
  const root = group(), viewport = group(), content = group();
  presentation(source, content);
  content.append(...Array.from(source.childNodes, node => node.cloneNode(true)));
  // Templates in effects.svg inherit the sheet's coordinate system and ancestor transforms.
  let artwork = content;
  let parent = source.parentElement;
  while (source.localName !== 'svg' && parent && parent.localName !== 'svg') {
    const ancestor = group(); presentation(parent, ancestor); ancestor.append(artwork); artwork = ancestor; parent = parent.parentElement;
  }
  const sheet = source.localName === 'svg' ? source : parent;
  if (source.localName !== 'svg' && sheet) {
    const inherited = group(); presentation(sheet, inherited); inherited.append(artwork); artwork = inherited;
  }
  const { a, d, e, f } = viewBoxMatrix(sheet?.getAttribute('viewBox') ?? null, target);
  viewport.setAttribute('transform', `matrix(${a} 0 0 ${d} ${e} ${f})`);
  viewport.append(artwork); root.append(viewport);
  for (const node of root.querySelectorAll('*')) frames.set(node, { root });
  return root;
}
function frame(node: SVGElement) {
  const layout = frames.get(node);
  if (!layout || layout.matrix) return layout;
  let matrix = new DOMMatrix();
  layout.transform = node.getAttribute('transform') ?? '';
  // Local transform lists work even while an asset is detached or hidden.
  for (let ancestor: Element | null = node; ancestor && ancestor !== layout.root; ancestor = ancestor.parentElement) {
    const transform = (ancestor as SVGGraphicsElement).transform?.baseVal.consolidate()?.matrix;
    if (transform) matrix = new DOMMatrix([transform.a, transform.b, transform.c, transform.d, transform.e, transform.f]).multiply(matrix);
  }
  layout.matrix = matrix; layout.inverse = matrix.inverse();
  return layout;
}
/** Animation coordinates stay in game units, even if exported paths are translated or scaled. */
export function artPoint(node: SVGElement, x: number, y: number) {
  const inverse = frame(node)?.inverse;
  return inverse ? inverse.transformPoint({ x, y }) : { x, y };
}
export function artLength(node: SVGElement, value: number, axis: 'x' | 'y') {
  const matrix = frame(node)?.matrix;
  if (!matrix) return value;
  return value / (axis === 'x' ? Math.hypot(matrix.a, matrix.b) : Math.hypot(matrix.c, matrix.d));
}
export function animateTranslation(node: SVGElement, x: number, y: number) {
  const layout = frame(node), inverse = layout?.inverse;
  const dx = inverse ? inverse.a * x + inverse.c * y : x;
  const dy = inverse ? inverse.b * x + inverse.d * y : y;
  node.setAttribute('transform', `${layout?.transform ?? ''} translate(${dx} ${dy})`.trim());
}
