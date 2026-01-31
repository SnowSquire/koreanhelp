import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { arrSymbols } from "./arrays";
import { koreanToIPA } from "./korean-to-ipa";

const SPEAKERS = ["JE", "JH", "PL", "JW"];
const TEMP_AUDIO_DIR = path.join(process.cwd(), "temp_ipa_audio");
const FINAL_AUDIO_DIR = path.join(process.cwd(), "src/assets/korean_audio");

interface IPASymbol {
	Symbol: string;
	U_No: string;
	IPA_No: string;
	Descr: string;
	IPA_Name: string;
}

interface KoreanMapping {
	koreanSymbol: string;
	ipaSequence: string[]; // Array of IPA symbols in sequence
}

async function downloadFile(url: string, outputPath: string): Promise<boolean> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			return false;
		}
		const arrayBuffer = await response.arrayBuffer();
		await Bun.write(outputPath, arrayBuffer);
		return true;
	} catch (error) {
		return false;
	}
}

async function main() {
	console.log("Starting IPA audio download to Korean symbol folders...\n");

	const downloadStats = {
		total: 0,
		successful: 0,
		failed: 0,
	};

	const soundToSymbols = new Map<string, string[]>();

	// Parse Korean IPA mappings - handle both simple and composite sounds
	const koreanMappings: KoreanMapping[] = [];
	const allNeededIpaSymbols = new Set<string>();

	for (const [koreanSymbol, ipaMapping] of Object.entries(koreanToIPA)) {
		// Parse the IPA mapping - split by character but handle multi-char symbols
		const ipaSequence: string[] = [];
		let i = 0;
		while (i < ipaMapping.length) {
			// Check for multi-character IPA symbols (combining characters)
			if (i + 2 < ipaMapping.length) {
				const threeChar = ipaMapping.substring(i, i + 3);
				// Check for "t͡ɕ" type combinations
				if (threeChar === "t͡ɕ") {
					ipaSequence.push(threeChar);
					i += 3;
					continue;
				}
			}
			if (i + 1 < ipaMapping.length) {
				const twoChar = ipaMapping.substring(i, i + 2);
				// Check for two-character sequences like "tʰ", "kʰ", "pʰ", "jɛ", etc.
				if (
					twoChar === "tʰ" ||
					twoChar === "kʰ" ||
					twoChar === "pʰ" ||
					twoChar === "jɛ" ||
					twoChar === "ja" ||
					twoChar === "jʌ" ||
					twoChar === "je"
				) {
					ipaSequence.push(twoChar);
					i += 2;
					continue;
				}
			}
			ipaSequence.push(ipaMapping[i]);
			i++;
		}

		koreanMappings.push({ koreanSymbol, ipaSequence });
		ipaSequence.forEach((seq) => {
			// For composite sequences like "ja", add both "j" and "a" as needed symbols
			for (const char of seq) {
				allNeededIpaSymbols.add(char);
			}
		});
	}

	// Filter arrSymbols to only include Korean-relevant IPA symbols
	const relevantSymbols = arrSymbols.filter((symbol) => {
		const ipaSymbol = (symbol as IPASymbol).Symbol;
		return allNeededIpaSymbols.has(ipaSymbol);
	});

	console.log(`Found ${relevantSymbols.length} relevant IPA symbols\n`);

	// Build a map from IPA symbol to its U_No
	const ipaToUNo = new Map<string, string>();
	for (const symbolData of relevantSymbols) {
		const symbol = (symbolData as IPASymbol).Symbol;
		const uNo = (symbolData as IPASymbol).U_No;

		// Skip combined characters (contain " + ")
		if (uNo.includes(" + ")) {
			continue;
		}

		if (uNo) {
			ipaToUNo.set(symbol, uNo);
		}
	}

	// Now download for each Korean symbol
	for (const { koreanSymbol, ipaSequence } of koreanMappings) {
		console.log(
			`Processing ${koreanSymbol} with IPA sequence: [${ipaSequence.join(", ")}]`,
		);

		const symbolDir = path.join(FINAL_AUDIO_DIR, koreanSymbol);
		await mkdir(symbolDir, { recursive: true });

		// Expand composite sequences into individual IPA symbols
		const expandedIpaSymbols: string[] = [];
		for (const seq of ipaSequence) {
			// If it's a two-char sequence like "ja", split it
			if (seq.length > 1) {
				for (const char of seq) {
					expandedIpaSymbols.push(char);
				}
			} else {
				expandedIpaSymbols.push(seq);
			}
		}

		// Download each sound in the expanded sequence
		for (let seqIndex = 0; seqIndex < expandedIpaSymbols.length; seqIndex++) {
			const ipaSymbol = expandedIpaSymbols[seqIndex];
			const uNo = ipaToUNo.get(ipaSymbol);

			if (!uNo) {
				console.log(`  ⚠️  No U_No found for IPA symbol: ${ipaSymbol}`);
				continue;
			}

			// Track which symbols use this sound
			if (!soundToSymbols.has(uNo)) {
				soundToSymbols.set(uNo, []);
			}
			soundToSymbols.get(uNo)!.push(ipaSymbol);

			let downloadedAny = false;

			// Determine suffix for composite sounds
			const suffix = expandedIpaSymbols.length > 1 ? `-${seqIndex + 1}` : "";

			// Try to download from each speaker
			for (const speaker of SPEAKERS) {
				const url = `https://www.internationalphoneticassociation.org/IPAcharts/common_files/sounds/${speaker}/${uNo}.mp3`;
				const outputPath = path.join(symbolDir, `${speaker}${suffix}.mp3`);

				console.log(
					`  Downloading: ${koreanSymbol} part ${seqIndex + 1}/${expandedIpaSymbols.length} (IPA: ${ipaSymbol}, ${speaker}) from ${uNo}.mp3`,
				);

				const success = await downloadFile(url, outputPath);

				if (success) {
					downloadedAny = true;
					downloadStats.successful++;
				} else {
					console.log(`    ❌ Failed to download from ${speaker}`);
				}

				downloadStats.total++;
			}

			if (!downloadedAny) {
				console.log(
					`    ⚠️  No audio files found for ${ipaSymbol} (U_No: ${uNo})`,
				);
				downloadStats.failed++;
			} else {
				console.log(
					`    ✅ Downloaded audio for ${koreanSymbol} part ${seqIndex + 1} (IPA: ${ipaSymbol})`,
				);
			}
		}

		console.log("");
	}

	// Report repeated sounds
	console.log("\n" + "=".repeat(60));
	console.log("REPEATED SOUNDS:");
	const repeatedSounds = Array.from(soundToSymbols.entries()).filter(
		([_, symbols]) => symbols.length > 1,
	);

	if (repeatedSounds.length > 0) {
		for (const [uNo, symbols] of repeatedSounds) {
			console.log(`  U+${uNo}: ${symbols.join(", ")}`);
		}
	} else {
		console.log("  No repeated sounds found");
	}

	// Summary
	console.log("\n" + "=".repeat(60));
	console.log("DOWNLOAD SUMMARY:");
	console.log(`  Total download attempts: ${downloadStats.total}`);
	console.log(`  Successful: ${downloadStats.successful}`);
	console.log(`  Failed: ${downloadStats.total - downloadStats.successful}`);

	console.log("\n" + "=".repeat(60));
	console.log(
		"Files saved to Korean symbol folders in: src/assets/korean_audio",
	);
	console.log("Wikipedia .ogg files preserved.");
	console.log(
		"\nComposite sounds (like 'ja') are split into multiple files with -1, -2 suffixes.",
	);
}

main().catch(console.error);
