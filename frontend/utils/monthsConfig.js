// Настройки месячных вкладок рейтинга.
// key — ключ вкладки, fromPeriod/toPeriod — префиксы колонок в result.csv
// (result.csv генерируется merge.js как `${prefix}-file;${prefix}-streak;${prefix}-xp`,
// префиксы там: start, 1m, 2m, 3m, 4m, ...), days — ожидаемое число дней между
// чекпоинтами, порог непрерывности streak для этого месяца.
export const MONTHS = [
	{ key: '1m', label: '1 месяц', fromPeriod: 'start', toPeriod: '1m', days: 30 },
	{ key: '2m', label: '2 месяц', fromPeriod: '1m', toPeriod: '2m', days: 30 },
	{ key: '3m', label: '3 месяц', fromPeriod: '2m', toPeriod: '3m', days: 30 },
	{ key: '4m', label: '4 месяц', fromPeriod: '3m', toPeriod: '4m', days: 31 },
	{ key: '5m', label: '5 месяц', fromPeriod: '4m', toPeriod: '5m', days: 29 },// хотя должно быть 31
]
