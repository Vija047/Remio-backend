import { PredictionEngine } from './prediction.engine';

function daysFrom(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

describe('PredictionEngine', () => {
  const engine = new PredictionEngine();
  const start = new Date('2026-01-01T12:00:00.000Z');

  it('1. returns learning status with no completion history', () => {
    const result = engine.calculate([]);
    expect(result.status).toBe('learning');
    expect(result.confidenceScore).toBe(0);
  });

  it('2. returns early low-confidence prediction for one interval', () => {
    const result = engine.calculate([start, daysFrom(start, 30)]);
    expect(result.status).toBe('ready');
    expect(result.averageIntervalDays).toBeCloseTo(30, 1);
    expect(result.confidenceScore).toBeLessThan(0.5);
    expect(result.bestDay).toBe(30);
  });

  it('3. predicts around regular intervals near 30-31 days', () => {
    const dates = [0, 30, 61, 91, 123].map((d) => daysFrom(start, d));
    // intervals: 30, 31, 30, 32
    const result = engine.calculate(dates);
    expect(result.status).toBe('ready');
    expect(result.averageIntervalDays).toBeGreaterThan(29);
    expect(result.averageIntervalDays).toBeLessThan(33);
    expect(result.bestDay).toBeGreaterThanOrEqual(29);
    expect(result.bestDay).toBeLessThanOrEqual(33);
  });

  it('4. handles irregular intervals with wider window', () => {
    const dates = [0, 20, 55, 75, 120].map((d) => daysFrom(start, d));
    const result = engine.calculate(dates);
    expect(result.status).toBe('ready');
    expect(result.maxDays).toBeGreaterThanOrEqual(result.minDays);
    expect(result.confidenceScore).toBeLessThan(0.85);
  });

  it('5. resists outlier intervals via median baseline', () => {
    const dates = [0, 30, 60, 90, 200].map((d) => daysFrom(start, d));
    // intervals 30,30,30,110 — median 30
    const result = engine.calculate(dates);
    expect(result.bestDay).toBeLessThan(50);
    expect(result.averageIntervalDays).toBeGreaterThan(40);
  });

  it('6. tracks increasing intervals with recent trend', () => {
    const dates = [0, 20, 45, 75, 110].map((d) => daysFrom(start, d));
    // intervals 20,25,30,35
    const result = engine.calculate(dates);
    expect(result.bestDay).toBeGreaterThan(25);
  });

  it('7. tracks decreasing intervals with recent trend', () => {
    const dates = [0, 40, 75, 105, 130].map((d) => daysFrom(start, d));
    // intervals 40,35,30,25
    const result = engine.calculate(dates);
    expect(result.bestDay).toBeLessThan(36);
  });

  it('8. assigns high confidence for consistent long history', () => {
    const dates = [0, 30, 60, 90, 120, 150, 180, 210].map((d) =>
      daysFrom(start, d),
    );
    const result = engine.calculate(dates);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.75);
  });

  it('9. assigns low confidence for sparse inconsistent history', () => {
    const dates = [0, 10, 60].map((d) => daysFrom(start, d));
    const result = engine.calculate(dates);
    expect(result.confidenceScore).toBeLessThan(0.55);
  });

  it('10. calculates predicted date from last completion + final interval', () => {
    const dates = [0, 30, 60, 90].map((d) => daysFrom(start, d));
    const result = engine.calculate(dates);
    const last = dates[dates.length - 1];
    const deltaDays =
      (result.predictedDate.getTime() - last.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(deltaDays).toBeCloseTo(result.averageIntervalDays, 0);
    expect(result.predictedDate.getTime()).toBeGreaterThan(last.getTime());
  });

  it('is deterministic for the same history', () => {
    const dates = [0, 30, 61, 91, 123].map((d) => daysFrom(start, d));
    const a = engine.calculate(dates);
    const b = engine.calculate(dates);
    expect(a).toEqual(b);
  });

  it('11. ignores duplicate same-day completion and preserves confidence score', () => {
    const regularDates = [0, 30, 60, 90, 120].map((d) => daysFrom(start, d));
    const withDuplicate = [...regularDates, new Date(regularDates[4].getTime() + 300000)]; // duplicate 5 mins later

    const resRegular = engine.calculate(regularDates);
    const resDuplicate = engine.calculate(withDuplicate);

    expect(resDuplicate.confidenceScore).toBeCloseTo(resRegular.confidenceScore, 2);
    expect(resDuplicate.bestDay).toBe(resRegular.bestDay);
    expect(resDuplicate.averageIntervalDays).toBe(resRegular.averageIntervalDays);
  });
});

