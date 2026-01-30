// Korean character decomposition utility
// Decomposes full Korean Hangul characters into their jamo components

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

const CHOSUNG = [
	"ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅄ", "ㅅ", "ㅆ",
	"ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

const JUNGSUNG = [
	"ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ",
	"ㅝ", "ㅞ", "ㅟ", "ㅢ", "ㅣ", "ㅤ", "ㅥ", "ㅦ", "ㅧ", "ㅨ",
];

const JONGSUNG = [
	"",
	"ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄸ", "ㄹ", "ㄺ", "ㄻ",
	"ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ",
	"ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

export interface DecomposedChar {
	char: string;
	chosung: string;
	jungsung: string;
	jongsung: string;
}

export function decomposeKoreanChar(char: string): DecomposedChar | null {
	const code = char.charCodeAt(0);

	if (code < HANGUL_START || code > HANGUL_END) {
		return null;
	}

	const syllableCode = code - HANGUL_START;
	const jongIdx = syllableCode % 28;
	const jungIdx = Math.floor((syllableCode / 28) % 21);
	const choIdx = Math.floor(syllableCode / (28 * 21));

	return {
		char,
		chosung: CHOSUNG[choIdx],
		jungsung: JUNGSUNG[jungIdx],
		jongsung: JONGSUNG[jongIdx],
	};
}

export function decompose(text: string): DecomposedChar[] {
	const result: DecomposedChar[] = [];
	for (let i = 0; i < text.length; i++) {
		const decomposed = decomposeKoreanChar(text[i]);
		if (decomposed) {
			result.push(decomposed);
		}
	}
	return result;
}

export function formatDecomposed(decomposed: DecomposedChar): string {
	const parts = [decomposed.chosung, decomposed.jungsung];
	if (decomposed.jongsung) {
		parts.push(decomposed.jongsung);
	}
	return `(${parts.join(" ")})`;
}
