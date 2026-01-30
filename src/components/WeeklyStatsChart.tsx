import { SolidUplot } from "@dschz/solid-uplot";
import type uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { createMemo, Show } from "solid-js";
import type { Trial } from "../historyStore";
import { computeWeeklyStats, weeklyStatsToUplotData } from "../lib/stats";

interface WeeklyStatsChartProps {
	trials: Trial[];
}

export function WeeklyStatsChart(props: WeeklyStatsChartProps) {
	const weeklyStats = createMemo(() => computeWeeklyStats(props.trials));
	const uplotData = createMemo(() => weeklyStatsToUplotData(weeklyStats()));

	const hasData = createMemo(() => weeklyStats().length > 0);

	const options = createMemo((): Omit<uPlot.Options, "width" | "height"> => ({
		scales: {
			x: { time: true },
			y: { auto: true },
			y2: { auto: true, range: [0, 100] },
		},
		axes: [
			{
				stroke: "#888",
				grid: { stroke: "#333", width: 1 },
			},
			{
				scale: "y",
				stroke: "#3b82f6",
				label: "Avg RT (ms)",
				labelFont: "12px system-ui",
				grid: { stroke: "#333", width: 1 },
				ticks: { stroke: "#3b82f6" },
			},
			{
				scale: "y2",
				side: 1,
				stroke: "#ef4444",
				label: "Fail %",
				labelFont: "12px system-ui",
				grid: { show: false },
				ticks: { stroke: "#ef4444" },
			},
		],
		series: [
			{}, // x-axis
			{
				label: "Avg RT",
				stroke: "#3b82f6",
				width: 2,
				scale: "y",
				points: { show: true, size: 6, fill: "#3b82f6" },
			},
			{
				label: "Fail %",
				stroke: "#ef4444",
				width: 2,
				scale: "y2",
				points: { show: true, size: 6, fill: "#ef4444" },
			},
		],
		legend: { show: true },
		cursor: { show: true },
	}));

	return (
		<div class="w-full">
			<h2 class="mb-4 text-xl font-semibold text-white/90">
				Past 7 Days
			</h2>
			<Show
				when={hasData()}
				fallback={
					<div class="flex h-64 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/50">
						<p class="text-white/50">
							No data yet. Start training to see your progress!
						</p>
					</div>
				}
			>
				<div class="h-80 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
					<SolidUplot
						{...options()}
						data={uplotData()}
						autoResize={true}
					/>
				</div>
			</Show>
		</div>
	);
}
