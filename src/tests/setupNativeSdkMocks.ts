/**
 * Jest mocks for native SDKs so unit tests never touch real AppMetrica / Ads.
 */

jest.mock('@appmetrica/react-native-analytics', () => ({
	__esModule: true,
	default: {
		activate: jest.fn(),
		reportEvent: jest.fn(),
	},
}))

jest.mock('yandex-mobile-ads', () => ({
	MobileAds: {
		initialize: jest.fn(() => Promise.resolve()),
	},
	BannerAdSize: {
		stickySize: jest.fn(() =>
			Promise.resolve({ width: 320, height: 50 }),
		),
	},
	BannerView: 'BannerView',
	InterstitialAdLoader: {
		create: jest.fn(async () => ({
			loadAd: jest.fn(async () => ({
				show: jest.fn(async () => undefined),
			})),
		})),
	},
	RewardedAdLoader: {
		create: jest.fn(async () => ({
			loadAd: jest.fn(async () => ({
				show: jest.fn(async () => undefined),
				onRewarded: null,
				onAdDismissed: null,
				onAdFailedToShow: null,
			})),
		})),
	},
}))
