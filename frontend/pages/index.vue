<template>
	<div class="page">
		<header class="header">
			<div class="header__inner">
				<div class="header__title">
					<h1>Рейтинг Алана Гаглоева</h1>
					<p>Прирост XP за {{ currentTabLabel }}</p>
				</div>
			</div>
		</header>

		<main class="main">
			<div class="container">
				<div v-if="loading" class="state-loading">
					<div class="state-loading__spinner"></div>
					<span>Загрузка результатов...</span>
				</div>

				<div v-else-if="error" class="state-error">
					{{ error }}
				</div>

				<template v-else>
					<div class="filter-tabs">
						<button
							v-for="tab in result?.tabs"
							:key="tab.key"
							type="button"
							class="filter-tabs__item"
							:class="{ 'filter-tabs__item--active': tab.key === filter }"
							@click="filter = tab.key"
						>
							{{ tab.label }}
						</button>
					</div>

					<div class="stats">
						<div class="stats__item">
							<span class="stats__value">{{ currentLeaderboard.length }}</span>
							<span class="stats__label">Участников</span>
						</div>
						<div class="stats__item">
							<span class="stats__value">{{ formatXp(currentLeaderboard[0]?.diff) }}</span>
							<span class="stats__label">Лучший результат</span>
						</div>
						<div class="stats__item">
							<span class="stats__value">{{ formatXp(totalXp) }}</span>
							<span class="stats__label">XP суммарно</span>
						</div>
					</div>

					<div class="search">
						<input
							v-model="search"
							class="search__input"
							type="text"
							placeholder="Поиск по имени..."
						/>
					</div>

					<div class="leaderboard">
						<div
							v-for="player in filteredLeaderboard"
							:key="player.username"
							class="leaderboard__row"
							:class="{
								'leaderboard__row--gold': player.rank === 0,
								'leaderboard__row--silver': player.rank === 1,
								'leaderboard__row--bronze': player.rank === 2,
							}"
						>
							<div class="leaderboard__rank">
								<span v-if="player.rank === 0" class="leaderboard__medal leaderboard__medal--gold">🥇</span>
								<span v-else-if="player.rank === 1" class="leaderboard__medal leaderboard__medal--silver">🥈</span>
								<span v-else-if="player.rank === 2" class="leaderboard__medal leaderboard__medal--bronze">🥉</span>
								<span v-else class="leaderboard__rank-num">{{ player.rank + 1 }}</span>
							</div>

							<div class="leaderboard__username">{{ player.username }}</div>

							<div class="leaderboard__xp-details">
								<span class="leaderboard__xp-start">{{ formatXp(player.fromXp) }}</span>
								<span class="leaderboard__xp-arrow">→</span>
								<span class="leaderboard__xp-final">{{ formatXp(player.toXp) }}</span>
							</div>

							<div class="leaderboard__diff">
								<span class="leaderboard__diff-value">+{{ formatXp(player.diff) }}</span>
								<div class="leaderboard__bar-wrap">
									<div
										class="leaderboard__bar"
										:style="{ width: barWidth(player.diff) + '%' }"
									></div>
								</div>
							</div>
						</div>
					</div>

					<template v-if="filteredDropped.length">
						<div class="dropped__heading">Выпали из рейтинга</div>
						<div class="dropped">
							<div
								v-for="player in filteredDropped"
								:key="player.username"
								class="dropped__row"
							>
								<span class="dropped__name">{{ player.username }}</span>
								<span class="dropped__reason">{{ player.reason }}</span>
							</div>
						</div>
					</template>
				</template>
			</div>
		</main>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { buildLeaderboards } from '@/utils/leaderboard.js'
import { MONTHS } from '@/utils/monthsConfig.js'

interface Player {
	username: string
	fromXp: number
	toXp: number
	diff: number
}

interface DroppedPlayer {
	username: string
	reason: string
}

interface Tab {
	key: string
	label: string
}

interface BuildResult {
	tabs: Tab[]
	data: Record<string, { leaderboard: Player[]; dropped: DroppedPlayer[] }>
}

const loading = ref(true)
const error = ref('')
const result = ref<BuildResult | null>(null)
const filter = ref('all')
const search = ref('')

async function loadLeaderboard()
{
	try {
		const res = await fetch('/result.csv')
		if (!res.ok) throw new Error('Не удалось загрузить данные')
		const text = await res.text()
		result.value = buildLeaderboards(text, MONTHS)
	} catch (e: any) {
		error.value = e.message
	} finally {
		loading.value = false
	}
}

const currentTabLabel = computed(() => result.value?.tabs.find(t => t.key === filter.value)?.label ?? '')

const currentLeaderboard = computed<Player[]>(() => result.value?.data[filter.value]?.leaderboard ?? [])

const currentDropped = computed<DroppedPlayer[]>(() => result.value?.data[filter.value]?.dropped ?? [])

const totalXp = computed(() => currentLeaderboard.value.reduce((sum, p) => sum + p.diff, 0))

const maxDiff = computed(() => currentLeaderboard.value[0]?.diff || 1)

const filteredLeaderboard = computed(() => {
	const q = search.value.trim().toLowerCase()
	return currentLeaderboard.value
		.map((player: Player, rank: number) => ({ ...player, rank }))
		.filter((player: Player & { rank: number }) => !q || player.username.toLowerCase().includes(q))
})

const filteredDropped = computed(() => {
	const q = search.value.trim().toLowerCase()
	return currentDropped.value.filter(u => !q || u.username.toLowerCase().includes(q))
})

// Ширина прогресс-бара в процентах
function barWidth(diff: number): number
{
	return Math.round((diff / maxDiff.value) * 100)
}

function formatXp(val: number | undefined): string
{
	if (val === undefined || val === null) return '—'
	return val.toLocaleString('ru-RU')
}

onMounted(loadLeaderboard)
</script>

<style lang="scss">
.page
{
	min-height: 100vh;
	display: flex;
	flex-direction: column;
}

.header
{
	background: $color-dark;
	color: $color-white;
	padding: 20px 0;
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);

	&__inner
	{
		max-width: 900px;
		margin: 0 auto;
		padding: 0 20px;
	}

	&__title
	{
		h1
		{
			font-size: 22px;
			font-weight: 700;
			color: $color-white;
		}

		p
		{
			font-size: 14px;
			color: rgba($color-white, 0.55);
			margin-top: 2px;
		}
	}
}

.main
{
	flex: 1;
	padding: 32px 0 48px;
}

.container
{
	max-width: 900px;
	margin: 0 auto;
	padding: 0 20px;
}

.filter-tabs
{
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-bottom: 20px;

	&__item
	{
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 600;
		color: $color-text-muted;
		background: $color-white;
		border: 1px solid $color-border;
		border-radius: 8px;
		cursor: pointer;
		@include transition(all);

		&:hover { border-color: $color-green; }

		&--active
		{
			color: $color-white;
			background: $color-green;
			border-color: $color-green;
		}
	}
}

.search
{
	margin-bottom: 16px;

	&__input
	{
		width: 100%;
		padding: 10px 16px;
		font-size: 15px;
		border: 1px solid $color-border;
		border-radius: 8px;
		outline: none;
		background: $color-white;
		color: $color-text;
		@include transition(border-color);

		&::placeholder { color: $color-text-muted; }
		&:focus { border-color: $color-green; }
	}
}

.state-loading
{
	@include flex-center;
	flex-direction: column;
	gap: 16px;
	padding: 80px 0;
	color: $color-text-muted;

	&__spinner
	{
		width: 40px;
		height: 40px;
		border: 3px solid $color-border;
		border-top-color: $color-green;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
}

@keyframes spin
{
	to { transform: rotate(360deg); }
}

.state-error
{
	text-align: center;
	padding: 60px 0;
	color: #c0392b;
}

.stats
{
	display: flex;
	gap: 16px;
	margin-bottom: 28px;

	@include media-md {
		flex-direction: column;
	}

	&__item
	{
		flex: 1;
		background: $color-white;
		border: 1px solid $color-border;
		border-radius: 10px;
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	&__value
	{
		font-size: 24px;
		font-weight: 700;
		color: $color-dark;
	}

	&__label
	{
		font-size: 13px;
		color: $color-text-muted;
	}
}

.leaderboard
{
	display: flex;
	flex-direction: column;
	gap: 8px;

	&__row
	{
		background: $color-white;
		border: 1px solid $color-border;
		border-radius: 10px;
		padding: 14px 18px;
		display: grid;
		grid-template-columns: 48px 1fr auto auto;
		align-items: center;
		gap: 12px;
		@include transition(box-shadow);

		&:hover { box-shadow: 0 4px 16px rgba($color-dark, 0.1); }

		&--gold
		{
			border-color: $color-gold;
			background: linear-gradient(135deg, #fffbea 0%, $color-white 60%);
		}

		&--silver
		{
			border-color: $color-silver;
			background: linear-gradient(135deg, #f5f7f8 0%, $color-white 60%);
		}

		&--bronze
		{
			border-color: $color-bronze;
			background: linear-gradient(135deg, #fff6ee 0%, $color-white 60%);
		}

		@include media-md {
			grid-template-columns: 36px 1fr;
			grid-template-rows: auto auto;

			.leaderboard__xp-details { grid-column: 2; }
			.leaderboard__diff { grid-column: 1 / -1; }
		}
	}

	&__rank { @include flex-center; }

	&__rank-num
	{
		font-size: 15px;
		font-weight: 700;
		color: $color-text-muted;
		width: 28px;
		text-align: center;
	}

	&__medal { font-size: 22px; }

	&__username
	{
		font-size: 15px;
		font-weight: 600;
		color: $color-text;
		word-break: break-all;
	}

	&__xp-details
	{
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: $color-text-muted;
		white-space: nowrap;
	}

	&__xp-start { color: $color-text-muted; }

	&__xp-arrow { color: $color-border; }

	&__xp-final
	{
		font-weight: 600;
		color: $color-dark;
	}

	&__diff
	{
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 5px;
		min-width: 120px;

		@include media-md {
			align-items: flex-start;
			min-width: 0;
			width: 100%;
		}
	}

	&__diff-value
	{
		font-size: 16px;
		font-weight: 700;
		color: $color-green-dark;
	}

	&__bar-wrap
	{
		width: 100%;
		height: 4px;
		background: $color-border;
		border-radius: 2px;
		overflow: hidden;
	}

	&__bar
	{
		height: 100%;
		background: $color-green;
		border-radius: 2px;
		@include transition(width, 0.6s, ease-out);
	}
}

.dropped
{
	display: flex;
	flex-wrap: wrap;
	gap: 8px;

	&__heading
	{
		font-size: 13px;
		font-weight: 600;
		color: $color-text-muted;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 24px 0 10px;
	}

	&__row
	{
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px;
		font-size: 13px;
		background: $color-white;
		border: 1px solid $color-border;
		border-radius: 6px;
	}

	&__name
	{
		font-weight: 600;
		color: $color-text;
	}

	&__reason
	{
		font-size: 11px;
		color: $color-text-muted;
	}
}
</style>
