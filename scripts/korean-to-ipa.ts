// Mapping of Korean symbols to IPA symbol names
export const koreanToIPA: Record<string, string> = {
	// Consonants
	ㄱ: "k", // VOICELESS VELAR PLOSIVE
	ㄴ: "n", // VOICED DENTAL/ALVEOLAR NASAL
	ㄷ: "t", // VOICELESS DENTAL/ALVEOLAR PLOSIVE
	ㄹ: "l", // VOICED DENTAL/ALVEOLAR LATERAL APPROXIMANT
	ㅁ: "m", // VOICED BILABIAL NASAL
	ㅂ: "p", // VOICELESS BILABIAL PLOSIVE
	ㅅ: "s", // VOICELESS ALVEOLAR FRICATIVE
	ㅇ: "ŋ", // VOICED VELAR NASAL
	ㅈ: "t͡ɕ", // Affricate (palatalized)
	ㅊ: "tʰ", // ASPIRATED DENTAL/ALVEOLAR PLOSIVE
	ㅋ: "kʰ", // ASPIRATED VELAR PLOSIVE
	ㅌ: "tʰ", // ASPIRATED DENTAL/ALVEOLAR PLOSIVE
	ㅍ: "pʰ", // ASPIRATED BILABIAL PLOSIVE
	ㅎ: "h", // VOICELESS GLOTTAL FRICATIVE

	// Vowels
	ㅏ: "a", // OPEN FRONT UNROUNDED VOWEL
	ㅐ: "ɛ", // OPEN-MID FRONT UNROUNDED VOWEL
	ㅑ: "ja", // j + a
	ㅒ: "jɛ", // j + ɛ
	ㅓ: "ʌ", // OPEN-MID BACK UNROUNDED VOWEL
	ㅔ: "e", // CLOSE-MID FRONT UNROUNDED VOWEL
	ㅕ: "jʌ", // j + ʌ
	ㅖ: "je", // j + e
	ㅗ: "o", // CLOSE-MID BACK ROUNDED VOWEL
	ㅜ: "u", // CLOSE BACK ROUNDED VOWEL
	ㅡ: "ɯ", // CLOSE BACK UNROUNDED VOWEL
	ㅣ: "i", // CLOSE FRONT UNROUNDED VOWEL
};
