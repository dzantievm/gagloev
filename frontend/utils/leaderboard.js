const DELIMITER = ';'

// Парсит CSV-строку в массив значений с учётом кавычек (логика взята из прежнего index.vue)
function parseCsvLine(line)
{
	const result = []
	let current = ''
	let inQuotes = false

	for (let i = 0; i < line.length; i++) {
		const ch = line[i]
		if (ch === '"') {
			inQuotes = !inQuotes
		} else if (ch === DELIMITER && !inQuotes) {
			result.push(current.trim())
			current = ''
		} else {
			current += ch
		}
	}
	result.push(current.trim())
	return result
}

// Разбирает CSV целиком: по заголовку находит колонки `${period}-streak`/`${period}-xp`
// для каждого periods (через indexOf, а не по номеру, чтобы не зависеть от порядка колонок)
// и возвращает список участников с их streak/xp по всем periods
function parsePlayers(csvText, periods)
{
	const lines = csvText.trim().split('\n')
	const header = parseCsvLine(lines[0])

	const columnIndexes = {}
	for (const period of periods) {
		columnIndexes[period] = {
			streak: header.indexOf(`${period}-streak`),
			xp: header.indexOf(`${period}-xp`),
		}
	}

	const players = []
	for (let i = 1; i < lines.length; i++) {
		if (!lines[i].trim()) continue
		const cols = parseCsvLine(lines[i])
		const username = cols[0]

		const playerPeriods = {}
		for (const period of periods) {
			const { streak, xp } = columnIndexes[period]
			const rawStreak = streak >= 0 ? cols[streak] : ''
			const rawXp = xp >= 0 ? cols[xp] : ''
			playerPeriods[period] = {
				streak: rawStreak === '' ? null : parseInt(rawStreak, 10),
				xp: rawXp === '' ? null : parseInt(rawXp, 10),
			}
		}

		players.push({ username, periods: playerPeriods })
	}

	return players
}

// Раскладывает участников на leaderboard/dropped для одного диапазона (месяц или «всё время»)
function classifyRange(players, fromPeriod, toPeriod, days, label, prevLabel, isAll)
{
	const leaderboard = []
	const dropped = []

	for (const player of players) {
		const from = player.periods[fromPeriod]
		const to = player.periods[toPeriod]

		if (from == null || from.xp == null) {
			dropped.push({
				username: player.username,
				reason: isAll ? 'Не участвовал с начала конкурса' : `Нет данных за ${prevLabel}`,
			})
			continue
		}

		if (to == null || to.xp == null) {
			dropped.push({
				username: player.username,
				reason: isAll ? 'Не прислал результат' : `Не прислал результат за ${label}`,
			})
			continue
		}

		const streakDiff = to.streak - from.streak
		if (streakDiff < days) {
			dropped.push({
				username: player.username,
				reason: `Streak ${streakDiff} / ${days} — пропустил день`,
			})
			continue
		}

		leaderboard.push({
			username: player.username,
			fromXp: from.xp,
			toXp: to.xp,
			diff: to.xp - from.xp,
		})
	}

	leaderboard.sort((a, b) => b.diff - a.diff)

	return { leaderboard, dropped }
}

// Точка входа: строит таблицы leaderboard/dropped по всем месячным вкладкам и сводной «всё время»
export function buildLeaderboards(csvText, months)
{
	const periods = ['start']
	for (const month of months) {
		if (!periods.includes(month.fromPeriod)) periods.push(month.fromPeriod)
		if (!periods.includes(month.toPeriod)) periods.push(month.toPeriod)
	}

	const players = parsePlayers(csvText, periods)

	const tabs = [{ key: 'all', label: 'Всё время' }]
	const data = {}

	for (const month of months) {
		const prevLabel = months.find(m => m.toPeriod === month.fromPeriod)?.label ?? 'старт конкурса'
		tabs.push({ key: month.key, label: month.label })
		data[month.key] = classifyRange(players, month.fromPeriod, month.toPeriod, month.days, month.label, prevLabel, false)
	}

	const fromPeriod = months[0].fromPeriod
	const toPeriod = months[months.length - 1].toPeriod
	const totalDays = months.reduce((sum, m) => sum + m.days, 0)
	data.all = classifyRange(players, fromPeriod, toPeriod, totalDays, '', '', true)

	return { tabs, data }
}
