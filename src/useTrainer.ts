import { makeAudioPlayer } from "@solid-primitives/audio";
import { createMemo, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import buzzerUrl from "./assets/wrong-answer-sound-effect.mp3";
import dingUrl from "./assets/ding.mp3";
import { useHistory } from "./historyStore";

// ─────────────────────────────────────────────────────────────
// Audio manifest (resolved at build time via Vite)
// ─────────────────────────────────────────────────────────────
const audioModules = import.meta.glob<string>(
	"./assets/korean_audio/**/*.{mp3,ogg,wav}",
	{ eager: true, query: "?url", import: "default" },
);

// Aspirated consonants to exclude (missing aspiration marker audio)
const EXCLUDED_SYMBOLS = new Set(["ㅊ", "ㅋ", "ㅌ", "ㅍ"]);

interface Clip {
	urls: string[]; // Array of URLs for multi-part sounds (played sequentially)
	speaker: string;
}

type Manifest = Record<string, Clip[]>;

function buildManifest(): Manifest {
	// First pass: collect all files grouped by symbol and speaker
	const symbolSpeakerFiles: Record<
		string,
		Record<string, { url: string; part: number; ext: string }[]>
	> = {};

	for (const [path, url] of Object.entries(audioModules)) {
		// Match patterns like: /korean_audio/ㅏ/JE.mp3 or /korean_audio/ㅕ/JE-1.mp3
		const match = path.match(
			/\/korean_audio\/([^/]+)\/([A-Za-z]+)(?:-(\d+))?\.(\w+)$/
		);
		if (!match) continue;

		const [, symbol, speaker, partStr, ext] = match;

		// Skip excluded symbols (aspirated consonants)
		if (EXCLUDED_SYMBOLS.has(symbol)) continue;

		// Skip wikipedia files for this logic (they're single files)
		if (speaker === "wikipedia") {
			// Handle wikipedia as a single-file clip
			if (!symbolSpeakerFiles[symbol]) symbolSpeakerFiles[symbol] = {};
			if (!symbolSpeakerFiles[symbol][speaker]) {
				symbolSpeakerFiles[symbol][speaker] = [];
			}
			symbolSpeakerFiles[symbol][speaker].push({ url, part: 0, ext });
			continue;
		}

		const part = partStr ? parseInt(partStr, 10) : 0;

		if (!symbolSpeakerFiles[symbol]) symbolSpeakerFiles[symbol] = {};
		if (!symbolSpeakerFiles[symbol][speaker]) {
			symbolSpeakerFiles[symbol][speaker] = [];
		}

		// Only add if this part number doesn't already exist (avoid duplicates)
		const existing = symbolSpeakerFiles[symbol][speaker].find(
			(f) => f.part === part
		);
		if (!existing) {
			symbolSpeakerFiles[symbol][speaker].push({ url, part, ext });
		}
	}

	// Second pass: build the manifest with ordered URLs
	const manifest: Manifest = {};

	for (const [symbol, speakers] of Object.entries(symbolSpeakerFiles)) {
		manifest[symbol] = [];

		for (const [speaker, files] of Object.entries(speakers)) {
			// Sort by part number
			files.sort((a, b) => a.part - b.part);

			// Check if this is a numbered multi-part sound
			const hasNumberedParts = files.some((f) => f.part > 0);

			if (hasNumberedParts) {
				// Only include files with part > 0 (numbered files)
				const numberedFiles = files.filter((f) => f.part > 0);
				const urls = numberedFiles.map((f) => f.url);
				if (urls.length > 0) {
					manifest[symbol].push({ urls, speaker });
				}
			} else {
				// Single file (part === 0)
				const singleFile = files.find((f) => f.part === 0);
				if (singleFile) {
					manifest[symbol].push({ urls: [singleFile.url], speaker });
				}
			}
		}
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
export type { Trial } from "./historyStore";

export type GameState = "idle" | "playing" | "awaiting" | "revealing";

interface Round {
	id: number;
	symbol: string;
	speaker: string;
	urls: string[]; // Array of URLs for multi-part sounds
	strikes: number;
	startedAt: number | null;
	wrongGuesses: string[];
}

interface TrainerState {
	gameState: GameState;
	round: Round | null;
	flashRed: boolean;
	flashGreen: boolean;
	easyMode: boolean;
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
	// Persisted history (shared singleton from historyStore)
	const [history, setHistory] = useHistory();

	// Derived stats
	const rollingAvg = createMemo(() => {
		const h = history();
		if (h.length === 0) return null;
		const slice = h.slice(-ROLLING_WINDOW);
		const sum = slice.reduce((acc: number, t) => acc + t.reactionMs, 0);
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
		easyMode: false,
	});

	// Audio setup - using raw Audio elements for sequencing
	const buzzer = makeAudioPlayer(buzzerUrl);
	buzzer.player.volume = 0.25;
	const ding = makeAudioPlayer(dingUrl);
	ding.player.volume = 0.5;

	// Audio sequencer state
	let audioElements: HTMLAudioElement[] = [];
	let currentPartIndex = 0;
	let isPlayingSequence = false;
	let currentRoundIdForAudio: number | null = null;

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

	// Stop any playing audio and clean up
	function stopAudioSequence() {
		isPlayingSequence = false;
		currentPartIndex = 0;
		for (const audio of audioElements) {
			audio.pause();
			audio.currentTime = 0;
			audio.onended = null;
			audio.onplaying = null;
		}
		audioElements = [];
	}

	// Preload and prepare audio elements for a sequence
	function prepareAudioSequence(urls: string[], roundId: number): void {
		stopAudioSequence();
		currentRoundIdForAudio = roundId;
		
		audioElements = urls.map((url, index) => {
			const audio = new Audio(url);
			audio.preload = "auto";
			
			// Set up the 'ended' event to play next part
			audio.onended = () => {
				if (!isPlayingSequence || currentRoundIdForAudio !== roundId) return;
				
				currentPartIndex++;
				if (currentPartIndex < audioElements.length) {
					// Play next part
					audioElements[currentPartIndex].play();
				} else {
					// Sequence complete
					isPlayingSequence = false;
					currentPartIndex = 0;
				}
			};

			// Set up the 'playing' event only for the first part
			if (index === 0) {
				audio.onplaying = () => {
					if (currentRoundIdForAudio !== roundId) return;
					
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
				};
			}

			return audio;
		});
	}

	// Start playing the audio sequence from the beginning
	function playAudioSequence(): void {
		if (audioElements.length === 0) return;
		
		currentPartIndex = 0;
		isPlayingSequence = true;
		audioElements[0].play();
	}

	// Replay the current sequence from the beginning
	function replayAudioSequence(): void {
		if (audioElements.length === 0) return;
		
		// Stop current playback
		for (const audio of audioElements) {
			audio.pause();
			audio.currentTime = 0;
		}
		
		currentPartIndex = 0;
		isPlayingSequence = true;
		audioElements[0].play();
	}

	// Cleanup on unmount
	onCleanup(() => {
		clearTimeouts();
		stopAudioSequence();
	});

	// ─────────────────────────────────────────────────────────
	// State transitions
	// ─────────────────────────────────────────────────────────

	function toPlaying(): void {
		clearTimeouts();
		stopAudioSequence();

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
				urls: clip.urls,
				strikes: 0,
				startedAt: null,
				wrongGuesses: [],
			},
			flashRed: false,
		});

		// Prepare and play the audio sequence
		prepareAudioSequence(clip.urls, newRoundId);
		playAudioSequence();
	}

	function toRevealing(roundId: number): void {
		// Guard: only proceed if this is still the current round
		if (!state.round || state.round.id !== roundId) return;

		setState("gameState", "revealing");

		// Replay audio for reveal
		replayAudioSequence();

		// Schedule next round
		revealTimeoutId = window.setTimeout(() => {
			// Guard again before transitioning
			if (state.round?.id === roundId) {
				toPlaying();
			}
		}, REVEAL_DELAY_MS);
	}

	function recordTrial(strikes: number): void {
		// Don't record in easy mode
		if (state.easyMode) return;
		
		if (!state.round || state.round.startedAt === null) return;

		const reactionMs = Math.round(performance.now() - state.round.startedAt);
		const roundSymbol = state.round.symbol;
		const roundSpeaker = state.round.speaker;
		const roundWrongGuesses = [...state.round.wrongGuesses];

		setHistory((prev) => [
			...prev,
			{
				symbol: roundSymbol,
				speaker: roundSpeaker,
				reactionMs,
				timestamp: Date.now(),
				strikes,
				wrongGuesses: roundWrongGuesses,
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
			
			// Flash green and wait for it to complete before starting next round
			setState("flashGreen", true);
			flashGreenTimeoutId = window.setTimeout(() => {
				setState("flashGreen", false);
				toPlaying();
			}, GREEN_FLASH_DURATION_MS);
			return;
		}

		// Wrong answer
		const newStrikes = state.round.strikes + 1;

		setState(
			produce((s) => {
				if (s.round) {
					s.round.strikes = newStrikes;
					s.round.wrongGuesses.push(input);
				}
			})
		);

		// Play buzzer
		buzzer.player.currentTime = 0;
		buzzer.play();

		// Flash red
		flashRedBriefly(roundId);

		// Check if max strikes reached (skip in easy mode)
		if (!state.easyMode && newStrikes >= MAX_STRIKES) {
			recordTrial(newStrikes);
			toRevealing(roundId);
		}
	}

	function replay(): void {
		if (state.gameState === "awaiting") {
			replayAudioSequence();
		}
	}

	function resetHistory(): void {
		if (confirm("Clear all saved history?")) {
			setHistory([]);
		}
	}

	function toggleEasyMode(): void {
		setState("easyMode", !state.easyMode);
	}

	// Separate audio elements for tile audio (doesn't interfere with main game)
	let tileAudioElements: HTMLAudioElement[] = [];
	let tileAudioIndex = 0;
	let isTileAudioPlaying = false;

	function stopTileAudio(): void {
		isTileAudioPlaying = false;
		tileAudioIndex = 0;
		for (const audio of tileAudioElements) {
			audio.pause();
			audio.currentTime = 0;
			audio.onended = null;
		}
		tileAudioElements = [];
	}

	function playTileAudio(symbol: string): void {
		const clips = MANIFEST[symbol];
		if (!clips || clips.length === 0) return;

		// Stop any currently playing tile audio
		stopTileAudio();

		const clip = pickRandom(clips);
		
		// Create audio elements for the sequence
		tileAudioElements = clip.urls.map((url) => {
			const audio = new Audio(url);
			audio.preload = "auto";
			
			audio.onended = () => {
				if (!isTileAudioPlaying) return;
				
				tileAudioIndex++;
				if (tileAudioIndex < tileAudioElements.length) {
					tileAudioElements[tileAudioIndex].play();
				} else {
					isTileAudioPlaying = false;
					tileAudioIndex = 0;
				}
			};
			
			return audio;
		});

		// Start playing
		isTileAudioPlaying = true;
		tileAudioIndex = 0;
		if (tileAudioElements.length > 0) {
			tileAudioElements[0].play();
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
		toggleEasyMode,
		playTileAudio,
	};
}
