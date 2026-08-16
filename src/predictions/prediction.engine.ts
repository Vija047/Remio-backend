export type PredictionResult = {
  averageIntervalDays: number;
  minDays: number;
  bestDay: number;
  maxDays: number;
  confidenceScore: number;
  predictedDate: Date;
  status: 'ready' | 'learning';
  message?: string;
};

export class PredictionEngine {
  private readonly alpha = 0.3;

  /**
   * Deterministic prediction from completion timestamps (ascending not required).
   */
  calculate(completionDates: Date[]): PredictionResult {
    const sorted = [...completionDates].sort(
      (a, b) => a.getTime() - b.getTime(),
    );

    if (sorted.length < 2) {
      return {
        averageIntervalDays: 0,
        minDays: 0,
        bestDay: 0,
        maxDays: 0,
        confidenceScore: 0,
        predictedDate: sorted[0] ?? new Date(0),
        status: 'learning',
        message:
          'Complete this task a few more times so RoutineAI can learn your routine.',
      };
    }

    const intervals = this.computeIntervals(sorted);
    const medianInterval = this.median(intervals);
    const recentTrend = this.ewma(intervals);
    const finalInterval = 0.6 * medianInterval + 0.4 * recentTrend;
    const { minDays, maxDays } = this.predictionWindow(intervals, finalInterval);
    const confidenceScore = this.confidence(intervals);
    const lastCompletedAt = sorted[sorted.length - 1];
    const predictedDate = new Date(
      lastCompletedAt.getTime() + finalInterval * 24 * 60 * 60 * 1000,
    );
    const bestDay = Math.round(finalInterval);
    const averageIntervalDays =
      intervals.reduce((sum, value) => sum + value, 0) / intervals.length;

    return {
      averageIntervalDays: this.round4(averageIntervalDays),
      minDays,
      bestDay,
      maxDays,
      confidenceScore: this.round4(confidenceScore),
      predictedDate,
      status: 'ready',
    };
  }

  private computeIntervals(sorted: Date[]): number[] {
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const ms = sorted[i].getTime() - sorted[i - 1].getTime();
      intervals.push(ms / (24 * 60 * 60 * 1000));
    }
    return intervals;
  }

  private ewma(intervals: number[]): number {
    let estimate = intervals[0];
    for (let i = 1; i < intervals.length; i += 1) {
      estimate = this.alpha * intervals[i] + (1 - this.alpha) * estimate;
    }
    return estimate;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  private mad(values: number[], center: number): number {
    const deviations = values.map((value) => Math.abs(value - center));
    return this.median(deviations);
  }

  private percentile(sortedAsc: number[], p: number): number {
    if (sortedAsc.length === 1) {
      return sortedAsc[0];
    }
    const index = (sortedAsc.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
      return sortedAsc[lower];
    }
    const weight = index - lower;
    return sortedAsc[lower] * (1 - weight) + sortedAsc[upper] * weight;
  }

  private predictionWindow(
    intervals: number[],
    finalInterval: number,
  ): { minDays: number; maxDays: number } {
    if (intervals.length < 4) {
      const spread = Math.max(1, Math.round(finalInterval * 0.15));
      const center = Math.round(finalInterval);
      return {
        minDays: Math.max(1, center - spread),
        maxDays: center + spread,
      };
    }

    const sorted = [...intervals].sort((a, b) => a - b);
    const p25 = this.percentile(sorted, 0.25);
    const p75 = this.percentile(sorted, 0.75);
    return {
      minDays: Math.max(1, Math.round(p25)),
      maxDays: Math.max(1, Math.round(p75)),
    };
  }

  private confidence(intervals: number[]): number {
    const count = intervals.length;
    let historyFactor: number;
    if (count === 1) {
      historyFactor = 0.25;
    } else if (count <= 3) {
      historyFactor = 0.5;
    } else if (count <= 6) {
      historyFactor = 0.75;
    } else {
      historyFactor = 1;
    }

    const medianInterval = this.median(intervals);
    const variability =
      medianInterval === 0
        ? 1
        : this.mad(intervals, medianInterval) / medianInterval;
    const consistencyFactor = Math.max(0, 1 - variability);

    let score = 0.45 * historyFactor + 0.55 * consistencyFactor;
    if (count === 1) {
      score = Math.min(score, 0.35);
    } else if (count <= 3) {
      score = Math.min(score, 0.6);
    }

    return Math.min(1, Math.max(0, score));
  }

  private round4(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
