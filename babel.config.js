// babel.config.js — Expo + Reanimated (required by Skia gesture stack).
module.exports = function (api) {
	api.cache(true)
	return {
		presets: ['babel-preset-expo'],
		plugins: ['react-native-reanimated/plugin'],
	}
}
