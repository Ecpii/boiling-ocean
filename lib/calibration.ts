/**
 * Confidence calibration: ECE (Expected Calibration Error) and reliability diagram.
 * Bucket predictions by confidence (e.g. 5 bins: 0-20, 20-40, 40-60, 60-80, 80-100)
 * and compare average confidence to actual accuracy per bin.
 */

export interface CalibrationBin {
  binMin: number;
  binMax: number;
  avgConfidence: number;
  accuracy: number;
  count: number;
}

export interface CalibrationResult {
  ece: number;
  numBins: number;
  bins: CalibrationBin[];
}

const NUM_BINS_DEFAULT = 5;

/**
 * Compute ECE and bin stats from (confidence 0-100, correct) pairs.
 * Bins are equal-width: [0,20), [20,40), [40,60), [60,80), [80,100].
 */
export function computeCalibration(
  pairs: { confidence: number; correct: boolean }[],
  numBins: number = NUM_BINS_DEFAULT
): CalibrationResult {
  if (pairs.length === 0) {
    const bins = Array.from({ length: numBins }, (_, i) => {
      const binMin = (i / numBins) * 100;
      const binMax = ((i + 1) / numBins) * 100;
      return { binMin, binMax, avgConfidence: 0, accuracy: 0, count: 0 };
    });
    return { ece: 0, numBins, bins };
  }

  const binWidth = 100 / numBins;
  const bins: CalibrationBin[] = Array.from({ length: numBins }, (_, i) => ({
    binMin: i * binWidth,
    binMax: (i + 1) * binWidth,
    avgConfidence: 0,
    accuracy: 0,
    count: 0,
  }));

  const sums: { confidence: number; correct: number; count: number }[] = bins.map(() => ({
    confidence: 0,
    correct: 0,
    count: 0,
  }));

  for (const { confidence, correct } of pairs) {
    const c = Math.max(0, Math.min(100, confidence));
    let binIndex = Math.floor(c / binWidth);
    if (binIndex >= numBins) binIndex = numBins - 1;
    sums[binIndex].confidence += c;
    sums[binIndex].correct += correct ? 1 : 0;
    sums[binIndex].count += 1;
  }

  let ece = 0;
  const n = pairs.length;

  for (let i = 0; i < numBins; i++) {
    const count = sums[i].count;
    if (count > 0) {
      bins[i].avgConfidence = sums[i].confidence / count;
      bins[i].accuracy = sums[i].correct / count;
      bins[i].count = count;
      ece += (count / n) * Math.abs(bins[i].avgConfidence / 100 - bins[i].accuracy);
    }
  }

  return { ece, numBins, bins };
}
