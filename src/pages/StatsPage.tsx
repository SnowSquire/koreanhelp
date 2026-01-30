import { A } from "@solidjs/router";
import { createMemo, For, Show } from "solid-js";
import { useHistory, clearHistory } from "../historyStore";
import { WeeklyStatsChart } from "../components/WeeklyStatsChart";
import {
	computeSymbolStats,
	computeGlobalBounds,
	computeComboScore,
	comboToHsla,
} from "../lib/stats";
import { SYMBOLS, TRANSLITERATION } from "../useTrainer";

export default function StatsPage() {
	const [history] = useHistory();

	const symbolStats = createMemo(() =>
		computeSymbolStats(history(), SYMBOLS)
	);

	const globalBounds = createMemo(() => computeGlobalBounds(history()));

	const hasData = createMemo(() => history().length > 0);

	return (
		<div class="min-h-screen bg-zinc-900 text-white/90">
			<div class="mx-auto max-w-4xl px-6 py-8">
				{/* Header */}
				<div class="mb-8 flex items-center justify-between">
					<h1 class="text-3xl font-bold">Stats</h1>
					<A
						href="/"
						class="rounded-lg border border-zinc-600 bg-transparent px-4 py-2 text-sm text-white/60 transition hover:bg-zinc-800 hover:text-white/90"
					>
						Back to Trainer
					</A>
				</div>

				{/* Weekly chart */}
				<div class="mb-10">
					<WeeklyStatsChart trials={history()} />
				</div>

				{/* Per-letter stats grid */}
				<div class="mb-8">
					<h2 class="mb-4 text-xl font-semibold">Per-Letter Stats</h2>
					<Show
						when={hasData()}
						fallback={
							<p class="text-white/50">
								No data yet. Start training to see per-letter statistics!
							</p>
						}
					>
						<div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
							<For each={symbolStats()}>
								{(stats) => {
									const combo = () =>
										computeComboScore(stats, globalBounds());
									const bgColor = () =>
										comboToHsla(combo(), stats.attempts);

									return (
										<div
											class="flex flex-col items-center rounded-lg border border-zinc-700 p-3 transition"
											style={{
												"background-color":
													stats.attempts > 0 ? bgColor() : "transparent",
											}}
										>
											<span class="text-2xl font-bold">{stats.symbol}</span>
											<span class="text-xs text-white/60">
												{TRANSLITERATION[stats.symbol] || ""}
											</span>
											<div class="mt-2 text-center text-xs">
												<Show
													when={stats.attempts > 0}
													fallback={<span class="text-white/40">—</span>}
												>
													<div>
														<span class="text-white/70">RT:</span>{" "}
														<span class="font-medium">
															{stats.modeMs ?? "—"} ms
														</span>
													</div>
													<div>
														<span class="text-white/70">Fail:</span>{" "}
														<span class="font-medium">
															{Math.round(stats.failRate * 100)}%
														</span>
													</div>
													<div>
														<span class="text-white/70">n:</span>{" "}
														<span class="font-medium">{stats.attempts}</span>
													</div>
												</Show>
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</Show>
				</div>

				{/* Legend */}
				<div class="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-sm text-white/70">
					<p class="mb-2 font-medium text-white/90">Color Legend</p>
					<p>
						Each letter's background color combines accuracy and response time:
					</p>
					<ul class="mt-2 list-inside list-disc space-y-1">
						<li>
							<span class="font-medium" style={{ color: "hsl(120 70% 45%)" }}>
								Green
							</span>{" "}
							= high accuracy + fast response
						</li>
						<li>
							<span class="font-medium" style={{ color: "hsl(60 70% 45%)" }}>
								Yellow
							</span>{" "}
							= moderate performance
						</li>
						<li>
							<span class="font-medium" style={{ color: "hsl(0 70% 45%)" }}>
								Red
							</span>{" "}
							= low accuracy or slow response
						</li>
						<li>
							<span class="text-white/50">Faded</span> = few attempts (less
							confident)
						</li>
					</ul>
					<p class="mt-2 text-white/50">
						"Fail" = any trial where you made at least one mistake.
					</p>
				</div>

				{/* Clear history */}
				<div class="text-center">
					<button
						type="button"
						class="rounded border border-zinc-600 bg-transparent px-4 py-2 text-sm text-white/60 transition hover:bg-zinc-800 hover:text-white/90"
						onClick={clearHistory}
					>
						Clear All History
					</button>
				</div>
			</div>
		</div>
	);
}
