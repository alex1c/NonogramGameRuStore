/**
 * Content build wrapper — validates existing pilot artifact (fail-closed).
 * npm run content:build
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const audit = spawnSync(
	process.platform === 'win32' ? 'npx.cmd' : 'npx',
	['tsx', 'scripts/audit-production-content.ts'],
	{ cwd: root, stdio: 'inherit', shell: false },
)
process.exitCode = audit.status === 0 ? 0 : 1
