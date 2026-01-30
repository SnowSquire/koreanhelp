import { useKeyDownEvent } from "@solid-primitives/keyboard";
import { A } from "@solidjs/router";
import { createEffect, For, Show } from "solid-js";
import {
	MAX_STRIKES,
	ROLLING_WINDOW,
	SYMBOLS,
	TRANSLITERATION,
	useTrainer,
} from "./useTrainer";

function App() {
	const trainer = useTrainer();

	// Keyboard input (Korean IME)
	const keyEvent = useKeyDownEvent();
	createEffect(() => {
		const e = keyEvent();
		if (!e) return;
		trainer.guess(e.key);
	});

	// Convenience accessors
	const gameState = () => trainer.state.gameState;
	const round = () => trainer.state.round;
	const flashRed = () => trainer.state.flashRed;
	const flashGreen = () => trainer.state.flashGreen;
	const strikes = () => round()?.strikes ?? 0;
	const currentSymbol = () => round()?.symbol ?? null;

	return (
		<div
			class="flex min-h-screen items-center justify-center text-white/90 transition-colors duration-300"
			classList={{
				"bg-zinc-900": !flashRed() && !flashGreen(),
				"bg-red-900": flashRed(),
				"bg-green-900": flashGreen(),
			}}
		>
			<div class="w-full max-w-3xl px-6 py-8">
				<h1 class="mb-8 text-center text-3xl font-bold">
					Korean Listening Trainer
				</h1>

				{/* Stats strip */}
				<div class="mb-8 flex flex-wrap justify-center gap-8">
					<div class="flex flex-col items-center">
						<span class="text-xs uppercase tracking-wider text-white/60">
							Last
						</span>
						<span class="text-2xl font-semibold">
							{trainer.lastReaction() !== null
								? `${trainer.lastReaction()} ms`
								: "—"}
						</span>
					</div>
					<div class="flex flex-col items-center">
						<span class="text-xs uppercase tracking-wider text-white/60">
							Avg (last {ROLLING_WINDOW})
						</span>
						<span class="text-2xl font-semibold">
							{trainer.rollingAvg() !== null
								? `${Math.round(trainer.rollingAvg()!)} ms`
								: "—"}
						</span>
					</div>
					<div class="flex flex-col items-center">
						<span class="text-xs uppercase tracking-wider text-white/60">
							Total
						</span>
						<span class="text-2xl font-semibold">
							{trainer.history().length}
						</span>
					</div>
				</div>

				{/* Control area - fixed height to prevent layout shift */}
				<div class="mb-8 flex h-40 flex-col items-center justify-center text-center">
					{/* Idle state: Start button */}
					<Show when={gameState() === "idle"}>
						<button
							type="button"
							class="rounded-lg bg-blue-600 px-8 py-3 text-lg font-medium text-white transition hover:bg-blue-700"
							onClick={trainer.start}
						>
							Start
						</button>
					</Show>

					{/* Active states: playing, awaiting, revealing */}
					<Show when={gameState() !== "idle"}>
						<div class="flex flex-col items-center gap-3">
							{/* Top text area */}
							<div class="flex h-7 items-center">
								<Show when={gameState() === "playing"}>
									<p class="text-lg">Playing...</p>
								</Show>
								<Show when={gameState() === "awaiting"}>
									<p class="text-lg">
										Select the symbol you heard
										<button
											type="button"
											class="ml-3 rounded border border-blue-500 bg-transparent px-3 py-1 text-sm text-blue-400 transition hover:bg-blue-600 hover:text-white"
											onClick={trainer.replay}
											title="Replay"
										>
											Replay
										</button>
									</p>
								</Show>
								<Show when={gameState() === "revealing"}>
									<p class="text-lg text-white/60">The answer was:</p>
								</Show>
							</div>

							{/* Symbol + transliteration area (fixed height, only visible during reveal) */}
							<div class="flex h-20 flex-col items-center justify-center">
								<Show when={gameState() === "revealing" && currentSymbol()}>
									<div class="text-5xl font-bold text-blue-400">
										{currentSymbol()}
									</div>
									<div class="text-lg text-white/80">
										{TRANSLITERATION[currentSymbol()!] || ""}
									</div>
								</Show>
							</div>

							{/* Strike indicator */}
							<div class="flex gap-2">
								<For each={Array.from({ length: MAX_STRIKES })}>
									{(_, i) => (
										<div
											class="h-3 w-3 rounded-full border-2 transition-colors"
											classList={{
												"border-red-500 bg-red-500": i() < strikes(),
												"border-zinc-600 bg-transparent": i() >= strikes(),
											}}
										/>
									)}
								</For>
							</div>
						</div>
					</Show>
				</div>

			{/* Symbol grid */}
			<div class="mb-8 grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
				<For each={SYMBOLS}>
					{(sym) => {
						const isCorrect = () => sym === currentSymbol();
						const isRevealing = () => gameState() === "revealing";
						const isAwaiting = () => gameState() === "awaiting";

						return (
							<button
								type="button"
								class="rounded-lg border-2 px-4 py-3 text-2xl transition disabled:cursor-not-allowed"
								classList={{
									// Correct answer during reveal: highlighted
									"!border-blue-500 !bg-blue-600 !text-white scale-110 shadow-lg shadow-blue-500/50":
										isRevealing() && isCorrect(),
									// Other symbols during reveal: darkened
									"!border-zinc-800 !bg-zinc-900 !text-white/30 !opacity-100":
										isRevealing() && !isCorrect(),
									// Normal state when awaiting
									"border-zinc-600 bg-zinc-800 text-white/90 hover:border-blue-500 hover:bg-zinc-700":
										isAwaiting(),
									// Normal state when not awaiting (idle/playing)
									"border-zinc-600 bg-zinc-800 text-white/90 opacity-50":
										!isAwaiting() && !isRevealing(),
								}}
								onClick={() => trainer.guess(sym)}
								disabled={!isAwaiting()}
							>
								{sym}
							</button>
						);
					}}
				</For>
			</div>

			{/* Reset history */}
			<div class="mb-8 flex justify-center gap-4">
				<A
					href="/stats"
					class="rounded border border-blue-500 bg-transparent px-4 py-2 text-sm text-blue-400 transition hover:bg-blue-600 hover:text-white"
				>
					View Stats
				</A>
				<button
					type="button"
					class="rounded border border-zinc-600 bg-transparent px-4 py-2 text-sm text-white/60 transition hover:bg-zinc-800 hover:text-white/90"
					onClick={trainer.resetHistory}
				>
					Reset History
				</button>
			</div>

			{/* Footer */}
			<div class="border-t border-zinc-700 pt-6 text-center text-xs text-white/40">
				<p class="mb-2">
					Voices from{" "}
					<a
						href="https://www.wikipedia.org"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-400 hover:underline"
					>
						Wikipedia
					</a>{" "}
					(CC BY-SA 3.0) and{" "}
					<a
						href="https://www.internationalphoneticassociation.org/IPAcharts/IPA_charts_EI/IPA_charts_EI.html"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-400 hover:underline"
					>
						International Phonetic Association
					</a>{" "}
					(CC BY-NC-ND 4.0)
				</p>
			</div>
		</div>
	</div>
	);
}

export default App;
