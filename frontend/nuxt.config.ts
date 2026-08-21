import { fileURLToPath } from 'node:url'

const baseDir = fileURLToPath(new URL('./assets/base/', import.meta.url))

export default defineNuxtConfig({
	ssr: false,
	devtools: { enabled: false },
	css: ['~/assets/base/global.scss'],
	vite: {
		css: {
			preprocessorOptions: {
				scss: {
					additionalData: `
						@use "${baseDir}variables" as *;
						@use "${baseDir}mixins" as *;
					`,
				},
			},
		},
	},
})
