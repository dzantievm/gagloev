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

// Раскладывает участников на leaderboard/dropped для одного диапазона (месяц или «всё время»).
// Если у игрока нет данных за period сразу перед toPeriod (пропустил чекпоинт), пропуск месяца
// не выкидывает его из конкурса: ищем последний период с данными среди periodOrder[0..toIndex-1]
// и считаем прирост от него, а порог streak суммируем за все пропущенные месяцы.
// Для «всего времени» (isAll) прирост и порог streak всегда считаются от start.
function classifyRange(players, periodOrder, edgeDays, toIndex, label, isAll)
{
	const toPeriod = periodOrder[toIndex]
	const leaderboard = []
	const dropped = []

	for (const player of players) {
		const to = player.periods[toPeriod]

		if (to == null || to.xp == null) {
			dropped.push({
				username: player.username,
				reason: isAll ? 'Не прислал итоговый результат' : `Не прислал результат за ${label}`,
			})
			continue
		}

		// Для «всего времени» прирост считаем строго от старта, без поиска последнего периода с данными
		let fromIndex = -1
		for (let i = isAll ? 0 : toIndex - 1; i >= 0; i--) {
			const p = player.periods[periodOrder[i]]
			if (p != null && p.xp != null) {
				fromIndex = i
				break
			}
		}

		if (fromIndex === -1) {
			dropped.push({
				username: player.username,
				reason: 'Не участвовал с начала конкурса',
			})
			continue
		}

		const from = player.periods[periodOrder[fromIndex]]
		const days = edgeDays.slice(fromIndex, toIndex).reduce((sum, d) => sum + d, 0)

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
	const periodOrder = ['start', ...months.map(month => month.toPeriod)]
	const edgeDays = months.map(month => month.days)

	const players = parsePlayers(csvText, periodOrder)

	const tabs = [{ key: 'all', label: 'Всё время' }]
	const data = {}

	months.forEach((month, i) => {
		tabs.push({ key: month.key, label: month.label })
		data[month.key] = classifyRange(players, periodOrder, edgeDays, i + 1, month.label, false)
	})

	data.all = classifyRange(players, periodOrder, edgeDays, periodOrder.length - 1, '', true)

	return { tabs, data }
}
