#!/usr/bin/env node

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

// Load .env from project root
const envPath = new URL(".env", import.meta.url).pathname;
if (fs.existsSync(envPath)) {
	for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
		const match = line.match(/^([^#=]+)=(.*)$/);
		if (match) process.env[match[1].trim()] = match[2].trim();
	}
}
import { createObjectCsvWriter } from "csv-writer";

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

const MIME_TYPES = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".gif": "image/gif",
	".webp": "image/webp",
};

// Get args: node process.js <images_dir> <output.csv> --key=<api_key>
function parseArgs() {
	const args = process.argv.slice(2);

	let imagesDir = null;
	let outputCsv = "output.csv";
	let apiKey = process.env.ANTHROPIC_API_KEY;

	for (const arg of args) {
		if (arg.startsWith("--key=")) {
			apiKey = arg.slice("--key=".length);
		} else if (arg.startsWith("--output=")) {
			outputCsv = arg.slice("--output=".length);
		} else if (!imagesDir) {
			imagesDir = arg;
		}
	}

	return { imagesDir, outputCsv, apiKey };
}

// Extract Duolingo data from a single image using Claude
async function extractFromImage(client, imagePath) {
	const ext = path.extname(imagePath).toLowerCase();
	const mediaType = MIME_TYPES[ext];

	if (!mediaType) {
		throw new Error(`Unsupported file type: ${ext}`);
	}

	const imageData = fs.readFileSync(imagePath);
	const base64 = imageData.toString("base64");

	const response = await client.messages.create({
		model: "claude-opus-4-6",
		max_tokens: 256,
		messages: [
			{
				role: "user",
				content: [
					{
						type: "image",
						source: {
							type: "base64",
							media_type: mediaType,
							data: base64,
						},
					},
					{
						type: "text",
						text: `This is a screenshot of an Instagram story showing a Duolingo profile or stats.

Extract the following information and return ONLY a JSON object with these exact keys:
- "username": the Duolingo username visible in the Duolingo interface — it is often displayed in the format "@NICKNAME • HA DUOLINGO" or similar. Take the nickname part only (without @ and without "HA DUOLINGO"). Ignore any Instagram account handles. IMPORTANT: ignore the account "@alan_gagloev" completely — if that is the only username visible, return null.
- "streak": number of streak days shown in the Duolingo interface (integer, or null if not found)
- "xp": total XP points shown in the Duolingo interface (integer, or null if not found)

Return only valid JSON, no explanation. Example: {"username": "BOLATATI", "streak": 42, "xp": 15000}`,
					},
				],
			},
		],
	});

	const text = response.content[0].text.trim();

	// Extract JSON from response (handle cases where model adds extra text)
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch)
		throw new Error(`Could not parse JSON from response: ${text}`);

	return JSON.parse(jsonMatch[0]);
}

async function main() {
	const { imagesDir, outputCsv, apiKey } = parseArgs();

	if (!imagesDir) {
		console.error(
			"Usage: node process.js <images_dir> [--output=output.csv] [--key=API_KEY]"
		);
		console.error("API key can also be set via ANTHROPIC_API_KEY env var.");
		process.exit(1);
	}

	if (!apiKey) {
		console.error(
			"API key required. Pass --key=<key> or set ANTHROPIC_API_KEY."
		);
		process.exit(1);
	}

	if (!fs.existsSync(imagesDir)) {
		console.error(`Directory not found: ${imagesDir}`);
		process.exit(1);
	}

	const files = fs
		.readdirSync(imagesDir)
		.filter((f) =>
			SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase())
		)
		.sort();

	if (files.length === 0) {
		console.error(`No supported images found in: ${imagesDir}`);
		process.exit(1);
	}

	console.log(`Found ${files.length} image(s). Processing...`);

	const client = new Anthropic({ apiKey });

	const csvWriter = createObjectCsvWriter({
		path: outputCsv,
		header: [
			{ id: "file", title: "file" },
			{ id: "username", title: "username" },
			{ id: "streak", title: "streak" },
			{ id: "xp", title: "xp" },
		],
	});

	const records = [];

	for (const file of files) {
		const imagePath = path.join(imagesDir, file);
		process.stdout.write(`  ${file} ... `);

		try {
			const data = await extractFromImage(client, imagePath);
			records.push({
				file,
				username: data.username ?? "",
				streak: data.streak ?? "",
				xp: data.xp ?? "",
			});
			fs.unlinkSync(imagePath);
			console.log(
				`OK (user=${data.username}, streak=${data.streak}, xp=${data.xp})`
			);
		} catch (err) {
			console.log(`ERROR: ${err.message}`);
			records.push({ file, username: "ERROR", streak: "", xp: "" });
		}
	}

	await csvWriter.writeRecords(records);
	console.log(`\nSaved to ${outputCsv}`);
}

main();
