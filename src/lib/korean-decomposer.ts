// Korean character decomposition utility
// Decomposes full Korean Hangul characters into their jamo components
// Based on Unicode Hangul Syllables composition algorithm (in reverse)
// Composition: initial × 588 + medial × 28 + final + 44032 = syllable code
// Decomposition: reverse the above to extract initial, medial, and final

const HANGUL_START = 44032; // 0xAC00
const HANGUL_END = 55203; // 0xD7A3

// Initial consonants (chosung) - 19 consonants
const CHOSUNG = [
	"ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
	"ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
];

// Medial vowels (jungsung) - 21 vowels
const JUNGSUNG = [
	"ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ",
	"ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ",
	"ㅣ"
];

// Final consonants (jongsung) - 28 options (including no final consonant)
const JONGSUNG = [
	"", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
	"ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
	"ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
];

function decomposeKoreanChar(char: string): string | null {
	const code = char.codePointAt(0);

	if (code === undefined || code < HANGUL_START || code > HANGUL_END) {
		return null;
	}

	// Reverse the composition algorithm:
	// syllable = initial × 588 + medial × 28 + final + 44032
	const syllableIndex = code - HANGUL_START;
	
	// Extract components using division and modulo
	const finalIndex = syllableIndex % 28;
	const medialIndex = Math.floor(syllableIndex / 28) % 21;
	const initialIndex = Math.floor(syllableIndex / 588);

	const parts = [CHOSUNG[initialIndex], JUNGSUNG[medialIndex]];
	if (JONGSUNG[finalIndex]) {
		parts.push(JONGSUNG[finalIndex]);
	}
	return `(${parts.join("")})`;
}

export function decompose(text: string): string {
	let result = "";
	for (const char of text) {
		const decomposed = decomposeKoreanChar(char);
		if (decomposed) {
			result += decomposed;
		} else {
			result += char;
		}
	}
	return result;
}
