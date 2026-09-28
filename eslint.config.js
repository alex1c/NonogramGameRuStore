// Flat ESLint config for Expo SDK 57 + TypeScript strict.
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
	...expoConfig,
	{
		ignores: [
			'node_modules/**',
			'android/**',
			'ios/**',
			'dist/**',
			'.expo/**',
			'coverage/**',
			'scripts/**',
		],
	},
	{
		rules: {
			// Keep foundation lint strict but practical for RN/Expo.
			'import/no-unresolved': 'off',
		},
	},
])
