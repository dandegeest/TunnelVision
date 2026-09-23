import sharp from "sharp";

export type FrameMetrics = {
  ssim: number;
  mae: number;
  width: number;
  height: number;
};

function ssimPlane(a: Float64Array, b: Float64Array, width: number, height: number, win = 8): number {
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const scores: number[] = [];
  for (let y = 0; y <= height - win; y += win) {
    for (let x = 0; x <= width - win; x += win) {
      let sumA = 0;
      let sumB = 0;
      let sumAA = 0;
      let sumBB = 0;
      let sumAB = 0;
      const n = win * win;
      for (let j = 0; j < win; j += 1) {
        const row = (y + j) * width + x;
        for (let i = 0; i < win; i += 1) {
          const pa = a[row + i]!;
          const pb = b[row + i]!;
          sumA += pa;
          sumB += pb;
          sumAA += pa * pa;
          sumBB += pb * pb;
          sumAB += pa * pb;
        }
      }
      const muA = sumA / n;
      const muB = sumB / n;
      const varA = sumAA / n - muA * muA;
      const varB = sumBB / n - muB * muB;
      const cov = sumAB / n - muA * muB;
      scores.push(((2 * muA * muB + c1) * (2 * cov + c2)) / ((muA * muA + muB * muB + c1) * (varA + varB + c2)));
    }
  }
  if (scores.length === 0) {
    return 0;
  }
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

export async function compareFrameFiles(aPath: string, bPath: string): Promise<FrameMetrics> {
  const a = sharp(aPath).removeAlpha();
  const b = sharp(bPath).removeAlpha();
  const aMeta = await a.metadata();
  const bMeta = await b.metadata();
  const width = Math.min(aMeta.width ?? 0, bMeta.width ?? 0);
  const height = Math.min(aMeta.height ?? 0, bMeta.height ?? 0);
  if (width < 8 || height < 8) {
    throw new Error("Frame compare needs at least an 8×8 raster.");
  }
  const [aRaw, bRaw] = await Promise.all([
    a.resize(width, height, { fit: "fill" }).raw().toBuffer(),
    b.resize(width, height, { fit: "fill" }).raw().toBuffer(),
  ]);
  const pixels = width * height;
  let abs = 0;
  const planes = [0, 1, 2].map(() => ({
    a: new Float64Array(pixels),
    b: new Float64Array(pixels),
  }));
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 3;
    for (let c = 0; c < 3; c += 1) {
      const pa = aRaw[o + c]!;
      const pb = bRaw[o + c]!;
      abs += Math.abs(pa - pb);
      planes[c]!.a[i] = pa;
      planes[c]!.b[i] = pb;
    }
  }
  const ssim = planes.reduce((sum, plane) => sum + ssimPlane(plane.a, plane.b, width, height), 0) / 3;
  return { ssim, mae: abs / (pixels * 3), width, height };
}
