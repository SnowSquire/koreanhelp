import { A } from "@solidjs/router";
import { createSignal, createMemo } from "solid-js";
import { decompose } from "../lib/korean-decomposer";

export default function KoreanDecomposerPage() {
	const [text, setText] = createSignal("");
	
	const decomposed = createMemo(() => decompose(text()));

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
						onInput={(e) => setText(e.currentTarget.value)}
						placeholder="Type or paste Korean text here..."
						class="w-full h-32 rounded-lg bg-zinc-800 border border-zinc-700 p-4 text-white/90 placeholder-white/40 focus:border-zinc-500 focus:outline-none"
					/>
				</div>

				{/* Decomposed Output */}
				<div class="mb-8">
					<h2 class="text-lg font-semibold text-white/90 mb-4">Decomposed Components</h2>
					{decomposed() ? (
						<p class="text-base text-white/80 leading-relaxed">
							{decomposed()}
						</p>
					) : (
						<p class="text-white/50">
							{text() ? "No Korean characters found in input." : "Enter Korean text above to see decomposition."}
						</p>
					)}
				</div>

			</div>
		</div>
	);
}
