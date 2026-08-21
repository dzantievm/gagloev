import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MONTHES_DIR = path.join(__dirname, 'monthes')
const DELIMITER = ';'

// Normalize username to a canonical key
function normalizeUsername(raw) {
	if (!raw) return null
	let u = raw.trim()
	if (!u || u.toUpperCase() === 'ERROR') return null

	// "инста xxx" — extract xxx
	const instaMatch = u.match(/^инста\s+(.+)/i)
	if (instaMatch) u = instaMatch[1].trim()

	// "Full Name @handle" or just "@handle" — extract handle
	const atMatch = u.match(/@(\S+)/)
	if (atMatch) u = atMatch[1]
	else if (u.startsWith('@')) u = u.slice(1)

	u = u.toUpperCase().trim()
	return u || null
}

// Parse filename to period label and sort order
function parsePeriod(filename) {
	const name = path.basename(filename, '.csv')
	if (name === 'start') return { label: 'start', order: 0 }
	const m = name.match(/^(\d+)-month$/)
	if (m) return { label: `${m[1]}m`, order: parseInt(m[1]) }
	return { label: name, order: 999 }
}

// Parse CSV text into array of row objects
function parseCsv(text) {
	const lines = text.split('\n').map(l => l.trimEnd())
	if (!lines.length) return []

	const headers = lines[0].split(DELIMITER).map(h => h.trim().toLowerCase())

	const userCol = headers.indexOf('username')
	const streakCol = headers.indexOf('streak')
	const xpCol = headers.indexOf('xp')

	if (userCol === -1 || streakCol === -1 || xpCol === -1) {
		throw new Error(`Missing columns in header: ${lines[0]}`)
	}

	const fileCol = headers.indexOf('file')

	const rows = []
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		if (!line.trim()) continue
		const cols = line.split(DELIMITER)
		rows.push({
			username: cols[userCol]?.trim() ?? '',
			streak: cols[streakCol]?.trim() ?? '',
			xp: cols[xpCol]?.trim() ?? '',
			file: fileCol !== -1 ? cols[fileCol]?.trim() ?? '' : '',
		})
	}
	return rows
}

// Load all CSV files from monthes/, sorted by period
function loadFiles() {
	const files = fs.readdirSync(MONTHES_DIR)
		.filter(f => f.endsWith('.csv'))
		.map(f => ({ file: f, ...parsePeriod(f) }))
		.sort((a, b) => a.order - b.order)
	return files
}

function main() {
	const files = loadFiles()
	const periods = files.map(f => f.label)

	// username -> { period: { streak, xp } }
	const data = new Map()

	for (const { file, label } of files) {
		const text = fs.readFileSync(path.join(MONTHES_DIR, file), 'utf-8')
		const rows = parseCsv(text)
		const seen = new Set()

		for (const row of rows) {
			const username = normalizeUsername(row.username)
			if (!username || seen.has(username)) continue
			seen.add(username)

			if (!data.has(username)) data.set(username, {})
			const entry = data.get(username)
			if (!(label in entry)) entry[label] = { streak: row.streak, xp: row.xp, file: row.file }
		}
	}

	// Build CSV output
	const headerCols = ['username', ...periods.flatMap(p => [`${p}-file`, `${p}-streak`, `${p}-xp`])]
	const quote = v => `"${v}"`
	const csvLines = [headerCols.map(quote).join(DELIMITER)]

	for (const [username, periods_data] of [...data.entries()].sort()) {
		const row = [username, ...periods.flatMap(p => {
			const d = periods_data[p]
			return d ? [d.file, d.streak, d.xp] : ['', '', '']
		})]
		csvLines.push(row.map(quote).join(DELIMITER))
	}

	const outPath = path.join(__dirname, 'result.csv')
	fs.writeFileSync(outPath, csvLines.join('\n') + '\n', 'utf-8')
	console.log(`Done: ${data.size} participants → result.csv`)
	console.log(`Periods: ${periods.join(', ')}`)
}

main()
