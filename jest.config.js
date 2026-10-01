/** @type {import('jest').Config} */
module.exports = {
	preset: 'jest-expo',
	setupFilesAfterEnv: ['<rootDir>/src/tests/setupNativeSdkMocks.ts'],
	testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx)'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
	transformIgnorePatterns: [
		'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@appmetrica/.*|yandex-mobile-ads)',
	],
}
