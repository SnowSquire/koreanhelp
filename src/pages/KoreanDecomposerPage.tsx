import { A } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { decompose, formatDecomposed } from "../lib/korean-decomposer";

export default function KoreanDecomposerPage() {
	const [text, setText] = createSignal("");
	const [decomposed, setDecomposed] = createSignal<any[]>([]);

	const handleInput = (value: string) => {
		setText(value);
		setDecomposed(decompose(value));
	};

	return (
		<div class="min-h-screen bg-zinc-900 text-white/90">
			<div class="mx-auto max-w-2xl px-6 py-8">
				{/* Header */}
				<div class="mb-8 flex items-center justify-between">
					<h1 class="text-3xl font-bold">Korean Decomposer</h1>
					<A
						href="/"
						class="rounded-lg border border-zinc-600 bg-transparent px-4 py-2 text-sm text-white/60 transition hover:bg-zinc-800 hover:text-white/90"
					>
						Back
					</A>
				</div>

				{/* Instructions */}
				<div class="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-sm text-white/70">
					<p>Enter Korean text to see each character decomposed into its component jamo (자모).</p>
				</div>

				{/* Text Input */}
				<div class="mb-8">
					<label for="korean-input" class="block text-sm font-medium text-white/80 mb-2">
						Korean Text
					</label>
					<textarea
						id="korean-input"
						value={text()}
						onInput={(e) => handleInput(e.currentTarget.value)}
						placeholder="Type or paste Korean text here..."
						class="w-full h-32 rounded-lg bg-zinc-800 border border-zinc-700 p-4 text-white/90 placeholder-white/40 focus:border-zinc-500 focus:outline-none"
					/>
				</div>

				{/* Decomposed Output */}
				<div class="mb-8">
					<h2 class="text-lg font-semibold text-white/90 mb-4">Decomposed Components</h2>
					<Show
						when={decomposed().length > 0}
						fallback={
							<p class="text-white/50">
								{text() ? "No Korean characters found in input." : "Enter Korean text above to see decomposition."}
							</p>
						}
					>
						<p class="text-base text-white/80 leading-relaxed flex flex-wrap gap-2">
							<For each={decomposed()}>
								{(item) => (
									<span class="inline-block">
										<span class="font-semibold text-white/90">{item.char}</span>
										<span class="text-white/60 ml-1">{formatDecomposed(item)}</span>
									</span>
								)}
							</For>
						</p>
					</Show>
				</div>

				{/* Details Table */}
				<Show when={decomposed().length > 0}>
					<div class="mb-8">
						<h3 class="text-lg font-semibold text-white/90 mb-4">Details</h3>
						<div class="overflow-x-auto rounded-lg border border-zinc-700">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-zinc-700 bg-zinc-800/50">
										<th class="px-4 py-3 text-left font-medium text-white/70">Char</th>
										<th class="px-4 py-3 text-left font-medium text-white/70">Chosung (초성)</th>
										<th class="px-4 py-3 text-left font-medium text-white/70">Jungsung (중성)</th>
										<th class="px-4 py-3 text-left font-medium text-white/70">Jongsung (종성)</th>
									</tr>
								</thead>
								<tbody>
									<For each={decomposed()}>
										{(item) => (
											<tr class="border-b border-zinc-700/50">
												<td class="px-4 py-3 text-white/90 font-semibold">{item.char}</td>
												<td class="px-4 py-3 text-white/70">{item.chosung}</td>
												<td class="px-4 py-3 text-white/70">{item.jungsung}</td>
												<td class="px-4 py-3 text-white/70">{item.jongsung || "—"}</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</div>
				</Show>
			</div>
		</div>
	);
}
