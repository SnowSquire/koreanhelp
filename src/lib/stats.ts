import type { Trial } from "../historyStore";

// ─────────────────────────────────────────────────────────────
// Basic math utilities
// ─────────────────────────────────────────────────────────────

function clamp01(x: number): number {
	return Math.max(0, Math.min(1, x));
}

function mean(arr: number[]): number {
	if (arr.length === 0) return 0;
	return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
	if (arr.length < 2) return 0;
	const m = mean(arr);
	const variance = arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length;
	return Math.sqrt(variance);
}

function percentile(arr: number[], p: number): number {
	if (arr.length === 0) return 0;
	const sorted = [...arr].sort((a, b) => a - b);
	const idx = (p / 100) * (sorted.length - 1);
	const lower = Math.floor(idx);
	const upper = Math.ceil(idx);
	if (lower === upper) return sorted[lower];
	return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function roundToNearest(value: number, step: number): number {
	return Math.round(value / step) * step;
}

// ─────────────────────────────────────────────────────────────
// Dynamic bucketing mode (most common response time)
// ─────────────────────────────────────────────────────────────

export function computeMode(reactionMs: number[]): number | null {
	if (reactionMs.length === 0) return null;
	if (reactionMs.length === 1) return reactionMs[0];

	// Compute SD-driven bin width, clamped to [25ms, 250ms]
	const sd = stdDev(reactionMs);
	const rawBin = sd * 0.5;
	const binMs = Math.max(25, Math.min(250, roundToNearest(rawBin, 25) || 25));

	// Count buckets
	const bucketCounts = new Map<number, number>();
	for (const ms of reactionMs) {
		const bucket = Math.floor(ms / binMs);
		bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
	}

	// Find max bucket
	let maxBucket = 0;
	let maxCount = 0;
	for (const [bucket, count] of bucketCounts) {
		if (count > maxCount) {
			maxCount = count;
			maxBucket = bucket;
		}
	}

	// Return midpoint of the bucket
	return Math.round(maxBucket * binMs + binMs / 2);
}

// ─────────────────────────────────────────────────────────────
// Per-symbol stats
// ─────────────────────────────────────────────────────────────

export interface SymbolStats {
	symbol: string;
	attempts: number;
	modeMs: number | null;
	failRate: number; // 0..1, where "fail" = any strike
	accuracy: number; // 1 - failRate
}

export function computeSymbolStats(
	trials: Trial[],
	symbols: string[]
): SymbolStats[] {
	const bySymbol = new Map<string, Trial[]>();
	for (const sym of symbols) {
		bySymbol.set(sym, []);
	}
	for (const t of trials) {
		const arr = bySymbol.get(t.symbol);
		if (arr) arr.push(t);
	}

	return symbols.map((symbol) => {
		const symbolTrials = bySymbol.get(symbol) ?? [];
		const attempts = symbolTrials.length;
		if (attempts === 0) {
			return { symbol, attempts: 0, modeMs: null, failRate: 0, accuracy: 1 };
		}

		const reactionMs = symbolTrials.map((t) => t.reactionMs);
		const failedCount = symbolTrials.filter((t) => t.strikes > 0).length;
		const failRate = failedCount / attempts;

		return {
			symbol,
			attempts,
			modeMs: computeMode(reactionMs),
			failRate,
			accuracy: 1 - failRate,
		};
	});
}

// ─────────────────────────────────────────────────────────────
// Combined color (accuracy + response time -> red/yellow/green)
// ─────────────────────────────────────────────────────────────

const ACC_BAD = 0.6;
const ACC_GOOD = 0.98;
const W_ACC = 0.65;
const W_RT = 0.35;
const EPS = 1e-6;

export interface GlobalBounds {
	rtGood: number; // p20 of all reaction times
	rtBad: number; // p80 of all reaction times
}

export function computeGlobalBounds(trials: Trial[]): GlobalBounds {
	const allRt = trials.map((t) => t.reactionMs);
	if (allRt.length === 0) {
		return { rtGood: 500, rtBad: 2000 }; // sensible defaults
	}
	return {
		rtGood: percentile(allRt, 20),
		rtBad: percentile(allRt, 80),
	};
}

export function computeComboScore(
	stats: SymbolStats,
	bounds: GlobalBounds
): number {
	// Accuracy score: higher accuracy = higher score
	const accScore = clamp01((stats.accuracy - ACC_BAD) / (ACC_GOOD - ACC_BAD));

	// RT score: lower RT = higher score (log scale)
	let rtScore = 0.5; // default for no data
	if (stats.modeMs !== null && bounds.rtBad > bounds.rtGood) {
		const logBad = Math.log(bounds.rtBad);
		const logGood = Math.log(bounds.rtGood);
		const logRt = Math.log(Math.max(stats.modeMs, 1));
		rtScore = clamp01((logBad - logRt) / (logBad - logGood));
	}

	// Weighted geometric mean
	const combo = Math.exp(
		W_ACC * Math.log(EPS + accScore) + W_RT * Math.log(EPS + rtScore)
	);

	return clamp01(combo);
}

export function comboToColor(
	combo: number,
	attempts: number
): { hsl: string; alpha: number } {
	// Hue: 0 (red) to 120 (green)
	const hue = 120 * combo;
	const sat = 70;
	const lit = 45;

	// Confidence fade: starts showing around 4 attempts, solid by ~15
	const alpha = clamp01((attempts - 3) / 12);

	return {
		hsl: `hsl(${Math.round(hue)} ${sat}% ${lit}%)`,
		alpha,
	};
}

export function comboToHsla(combo: number, attempts: number): string {
	const { hsl, alpha } = comboToColor(combo, attempts);
	// Convert hsl(...) to hsla(..., alpha)
	const match = hsl.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
	if (match) {
		return `hsla(${match[1]}, ${match[2]}%, ${match[3]}%, ${alpha.toFixed(2)})`;
	}
	return hsl;
}

// ─────────────────────────────────────────────────────────────
// Weekly data for chart (past 7 days)
// ─────────────────────────────────────────────────────────────

export interface DayStats {
	dayStart: number; // unix timestamp (ms) for start of day
	avgRtMs: number;
	failRatePct: number; // 0-100
	attempts: number;
}

function getDayStart(timestamp: number): number {
	const d = new Date(timestamp);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

export function computeWeeklyStats(trials: Trial[]): DayStats[] {
	const now = Date.now();
	const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

	// Filter to last 7 days
	const recent = trials.filter((t) => t.timestamp >= sevenDaysAgo);

	// Group by day
	const byDay = new Map<number, Trial[]>();
	for (const t of recent) {
		const dayStart = getDayStart(t.timestamp);
		if (!byDay.has(dayStart)) {
			byDay.set(dayStart, []);
		}
		byDay.get(dayStart)!.push(t);
	}

	// Build array of day stats, sorted by day
	const dayStarts = Array.from(byDay.keys()).sort((a, b) => a - b);

	return dayStarts.map((dayStart) => {
		const dayTrials = byDay.get(dayStart)!;
		const attempts = dayTrials.length;
		const avgRtMs = mean(dayTrials.map((t) => t.reactionMs));
		const failedCount = dayTrials.filter((t) => t.strikes > 0).length;
		const failRatePct = attempts > 0 ? (failedCount / attempts) * 100 : 0;

		return { dayStart, avgRtMs, failRatePct, attempts };
	});
}

/**
 * Convert weekly stats to uPlot data format.
 * Returns [xSec[], avgRtMs[], failRatePct[]]
 */
export function weeklyStatsToUplotData(
	dayStats: DayStats[]
): [number[], number[], number[]] {
	const xSec = dayStats.map((d) => d.dayStart / 1000);
	const avgRtMs = dayStats.map((d) => d.avgRtMs);
	const failRatePct = dayStats.map((d) => d.failRatePct);
	return [xSec, avgRtMs, failRatePct];
}
