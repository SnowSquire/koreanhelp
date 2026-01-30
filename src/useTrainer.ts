import { createAudio, makeAudioPlayer } from "@solid-primitives/audio";
import { makePersisted } from "@solid-primitives/storage";
import { createMemo, createSignal, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import buzzerUrl from "./assets/wrong-answer-sound-effect.mp3";
import dingUrl from "./assets/ding.mp3";

// ─────────────────────────────────────────────────────────────
// Audio manifest (resolved at build time via Vite)
// ─────────────────────────────────────────────────────────────
const audioModules = import.meta.glob<string>(
	"./assets/korean_audio/**/*.{mp3,ogg,wav}",
	{ eager: true, query: "?url", import: "default" },
);

interface Clip {
	url: string;
	speaker: string;
	ext: string;
}

type Manifest = Record<string, Clip[]>;

function buildManifest(): Manifest {
	const manifest: Manifest = {};
	for (const [path, url] of Object.entries(audioModules)) {
		const match = path.match(/\/korean_audio\/([^/]+)\/([^/]+)\.(\w+)$/);
		if (!match) continue;
		const [, symbol, speaker, ext] = match;
		if (!manifest[symbol]) manifest[symbol] = [];
		manifest[symbol].push({ url, speaker, ext });
	}
	return manifest;
}

const MANIFEST = buildManifest();
export const SYMBOLS = Object.keys(MANIFEST).sort();

// ─────────────────────────────────────────────────────────────
// Transliteration map
// ─────────────────────────────────────────────────────────────
export const TRANSLITERATION: Record<string, string> = {
	// Consonants
	"ㄱ": "g/k",
	"ㄴ": "n",
	"ㄷ": "d/t",
	"ㄹ": "r/l",
	"ㅁ": "m",
	"ㅂ": "b/p",
	"ㅅ": "s",
	"ㅇ": "ng/silent",
	"ㅈ": "j",
	"ㅊ": "ch",
	"ㅋ": "k",
	"ㅌ": "t",
	"ㅍ": "p",
	"ㅎ": "h",
	// Vowels
	"ㅏ": "a",
	"ㅐ": "ae",
	"ㅑ": "ya",
	"ㅒ": "yae",
	"ㅓ": "eo",
	"ㅔ": "e",
	"ㅕ": "yeo",
	"ㅖ": "ye",
	"ㅗ": "o",
	"ㅜ": "u",
	"ㅡ": "eu",
	"ㅣ": "i",
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface Trial {
	symbol: string;
	speaker: string;
	reactionMs: number;
	timestamp: number;
	strikes: number;
}

export type GameState = "idle" | "playing" | "awaiting" | "revealing";

interface Round {
	id: number;
	symbol: string;
	speaker: string;
	url: string;
	strikes: number;
	startedAt: number | null;
}

interface TrainerState {
	gameState: GameState;
	round: Round | null;
	flashRed: boolean;
	flashGreen: boolean;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
export const ROLLING_WINDOW = 10;
export const MAX_STRIKES = 3;
const REVEAL_DELAY_MS = 3000;
const FLASH_DURATION_MS = 300;
const GREEN_FLASH_DURATION_MS = 1000;

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────
function pickRandom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

let roundIdCounter = 0;

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useTrainer() {
	// Persisted history
	const [history, setHistory] = makePersisted(createSignal<Trial[]>([]), {
		name: "korean-rt:v1",
	});

	// Derived stats
	const rollingAvg = createMemo(() => {
		const h = history();
		if (h.length === 0) return null;
		const slice = h.slice(-ROLLING_WINDOW);
		const sum = slice.reduce((acc, t) => acc + t.reactionMs, 0);
		return sum / slice.length;
	});

	const lastReaction = createMemo(() => {
		const h = history();
		return h.length > 0 ? h[h.length - 1].reactionMs : null;
	});

	// Core state using createStore
	const [state, setState] = createStore<TrainerState>({
		gameState: "idle",
		round: null,
		flashRed: false,
		flashGreen: false,
	});

	// Audio setup
	const [audioUrl, setAudioUrl] = createSignal<string>("");
	const [mainAudio, mainControls] = createAudio(audioUrl);
	const buzzer = makeAudioPlayer(buzzerUrl);
	buzzer.player.volume = 0.25;
	const ding = makeAudioPlayer(dingUrl);
	ding.player.volume = 0.5;

	// Resource tracking
	let prevSpeaker: string | null = null;
	let revealTimeoutId: number | null = null;
	let flashRedTimeoutId: number | null = null;
	let flashGreenTimeoutId: number | null = null;

	// Clear all pending timeouts
	function clearTimeouts() {
		if (revealTimeoutId !== null) {
			clearTimeout(revealTimeoutId);
			revealTimeoutId = null;
		}
		if (flashRedTimeoutId !== null) {
			clearTimeout(flashRedTimeoutId);
			flashRedTimeoutId = null;
		}
		if (flashGreenTimeoutId !== null) {
			clearTimeout(flashGreenTimeoutId);
			flashGreenTimeoutId = null;
		}
	}

	// Audio 'playing' event handler with round ID guard
	function handleAudioPlaying() {
		// Only transition to awaiting if we're in 'playing' state
		if (state.gameState === "playing" && state.round) {
			setState(
				produce((s) => {
					s.gameState = "awaiting";
					if (s.round) {
						s.round.startedAt = performance.now();
					}
				})
			);
		}
	}

	mainAudio.player.addEventListener("playing", handleAudioPlaying);

	// Cleanup on unmount
	onCleanup(() => {
		clearTimeouts();
		mainAudio.player.removeEventListener("playing", handleAudioPlaying);
	});

	// ─────────────────────────────────────────────────────────
	// State transitions
	// ─────────────────────────────────────────────────────────

	function toPlaying(): void {
		clearTimeouts();

		const symbol = pickRandom(SYMBOLS);
		const clips = MANIFEST[symbol];

		// Try to pick a different speaker
		let clip: Clip;
		if (clips.length > 1 && prevSpeaker) {
			const others = clips.filter((c) => c.speaker !== prevSpeaker);
			clip = others.length > 0 ? pickRandom(others) : pickRandom(clips);
		} else {
			clip = pickRandom(clips);
		}
		prevSpeaker = clip.speaker;

		const newRoundId = ++roundIdCounter;

		setState({
			gameState: "playing",
			round: {
				id: newRoundId,
				symbol,
				speaker: clip.speaker,
				url: clip.url,
				strikes: 0,
				startedAt: null,
			},
			flashRed: false,
		});

		setAudioUrl(clip.url);
		mainControls.play();
	}

	function toRevealing(roundId: number): void {
		// Guard: only proceed if this is still the current round
		if (!state.round || state.round.id !== roundId) return;

		setState("gameState", "revealing");

		// Replay audio for reveal
		mainAudio.player.currentTime = 0;
		mainControls.play();

		// Schedule next round
		revealTimeoutId = window.setTimeout(() => {
			// Guard again before transitioning
			if (state.round?.id === roundId) {
				toPlaying();
			}
		}, REVEAL_DELAY_MS);
	}

	function recordTrial(strikes: number): void {
		if (!state.round || state.round.startedAt === null) return;

		const reactionMs = Math.round(performance.now() - state.round.startedAt);

		setHistory((prev) => [
			...prev,
			{
				symbol: state.round!.symbol,
				speaker: state.round!.speaker,
				reactionMs,
				timestamp: Date.now(),
				strikes,
			},
		]);
	}

	function flashRedBriefly(roundId: number): void {
		setState("flashRed", true);
		flashRedTimeoutId = window.setTimeout(() => {
			// Guard: only clear flash if still same round
			if (state.round?.id === roundId) {
				setState("flashRed", false);
			}
		}, FLASH_DURATION_MS);
	}

	function flashGreenBriefly(): void {
		setState("flashGreen", true);
		flashGreenTimeoutId = window.setTimeout(() => {
			setState("flashGreen", false);
		}, GREEN_FLASH_DURATION_MS);
	}

	// ─────────────────────────────────────────────────────────
	// Actions
	// ─────────────────────────────────────────────────────────

	function start(): void {
		if (state.gameState === "idle") {
			toPlaying();
		}
	}

	function guess(input: string): void {
		if (state.gameState !== "awaiting" || !state.round) return;

		// Ignore if input is not a valid Korean symbol
		if (!SYMBOLS.includes(input)) return;

		const roundId = state.round.id;
		const isCorrect = input === state.round.symbol;

		if (isCorrect) {
			recordTrial(state.round.strikes);
			
			// Play ding sound
			ding.player.currentTime = 0;
			ding.play();
			
			// Flash green
			flashGreenBriefly();
			
			toPlaying();
			return;
		}

		// Wrong answer
		const newStrikes = state.round.strikes + 1;

		setState(
			produce((s) => {
				if (s.round) {
					s.round.strikes = newStrikes;
				}
			})
		);

		// Play buzzer
		buzzer.player.currentTime = 0;
		buzzer.play();

		// Flash red
		flashRedBriefly(roundId);

		// Check if max strikes reached
		if (newStrikes >= MAX_STRIKES) {
			recordTrial(newStrikes);
			toRevealing(roundId);
		}
	}

	function replay(): void {
		if (state.gameState === "awaiting") {
			mainAudio.player.currentTime = 0;
			mainControls.play();
		}
	}

	function resetHistory(): void {
		if (confirm("Clear all saved history?")) {
			setHistory([]);
		}
	}

	// ─────────────────────────────────────────────────────────
	// Public API
	// ─────────────────────────────────────────────────────────

	return {
		// State (readonly)
		state,
		history,

		// Derived
		rollingAvg,
		lastReaction,

		// Actions
		start,
		guess,
		replay,
		resetHistory,
	};
}
