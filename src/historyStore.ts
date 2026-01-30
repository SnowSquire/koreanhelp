import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface Trial {
	symbol: string;
	speaker: string;
	reactionMs: number;
	timestamp: number;
	strikes: number;
	wrongGuesses: string[]; // symbols the user incorrectly guessed
}

// ─────────────────────────────────────────────────────────────
// Persisted history store (singleton)
// ─────────────────────────────────────────────────────────────
const [history, setHistory] = makePersisted(createSignal<Trial[]>([]), {
	name: "korean-rt:v1",
});

export function useHistory() {
	return [history, setHistory] as const;
}

export function clearHistory(): void {
	if (confirm("Clear all saved history?")) {
		setHistory([]);
	}
}
