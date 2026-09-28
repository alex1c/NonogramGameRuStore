[CmdletBinding()]
param(
	[string]$OutputPath,
	[string]$Name,
	[string]$ProjectPath,
	[switch]$OpenFolder,
	[switch]$VerifyDimensions
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-Screenshot([string]$Reason, [string]$Suggestion) {
	throw "SCREENSHOT_STOP|$Reason|$Suggestion"
}

function Resolve-AdbPath([string]$Root) {
	$candidates = @()
	if ($env:ANDROID_HOME) { $candidates += Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' }
	if ($env:ANDROID_SDK_ROOT) { $candidates += Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe' }
	if ($env:LOCALAPPDATA) { $candidates += Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe' }
	$localProperties = Join-Path $Root 'android\local.properties'
	if (Test-Path -LiteralPath $localProperties -PathType Leaf) {
		$sdkLine = Get-Content -LiteralPath $localProperties | Where-Object { $_ -match '^\s*sdk\.dir=(.+)$' } | Select-Object -First 1
		if ($sdkLine) {
			$sdkPath = ([regex]::Match($sdkLine, '^\s*sdk\.dir=(.+)$')).Groups[1].Value.Trim().Replace('\\', '\')
			$candidates += Join-Path $sdkPath 'platform-tools\adb.exe'
		}
	}
	foreach ($candidate in $candidates) {
		if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
	}
	$command = Get-Command adb.exe, adb -ErrorAction SilentlyContinue | Select-Object -First 1
	if ($command) { return $command.Source }
	return $null
}

function Invoke-Adb([string]$AdbPath, [string[]]$Arguments) {
	$previousPreference = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		$output = @(& $AdbPath @Arguments 2>&1 | ForEach-Object { "$_" })
		$exitCode = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previousPreference
	}
	if ($exitCode -ne 0) {
		Stop-Screenshot "adb $($Arguments -join ' ') failed (exit $exitCode): $($output -join ' ')" 'Check ADB, the connected device, and the requested output path.'
	}
	return $output
}

try {
	$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
	$inferredRoot = $null
	$rootCandidate = $scriptDirectory
	for ($depth = 0; $depth -lt 5 -and $rootCandidate; $depth++) {
		if (Test-Path -LiteralPath (Join-Path $rootCandidate 'package.json') -PathType Leaf) {
			$inferredRoot = $rootCandidate
			break
		}
		$parentCandidate = Split-Path -Parent $rootCandidate
		if ($parentCandidate -eq $rootCandidate) { break }
		$rootCandidate = $parentCandidate
	}
	if ($ProjectPath) {
		if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
			Stop-Screenshot "ProjectPath does not exist: $ProjectPath" 'Pass an existing app project root.'
		}
		$projectRoot = (Resolve-Path -LiteralPath $ProjectPath).Path
	} else {
		if (-not $inferredRoot) { Stop-Screenshot 'Could not find package.json above the screenshot script.' 'Pass -ProjectPath with the application root.' }
		$projectRoot = (Resolve-Path -LiteralPath $inferredRoot).Path
	}

	if ($OutputPath -and $Name) {
		Stop-Screenshot '-OutputPath and -Name cannot be combined.' 'Pass one full PNG path, or a name under the default screenshots folder.'
	}
	if ($OutputPath) {
		$destination = [IO.Path]::GetFullPath($OutputPath)
	} else {
		if (-not $Name) { $Name = Get-Date -Format 'yyyyMMdd-HHmmss' }
		if ([IO.Path]::GetFileName($Name) -ne $Name) {
			Stop-Screenshot 'Name must be a filename without a directory.' 'Use -OutputPath for a custom destination.'
		}
		if (-not $Name.EndsWith('.png', [StringComparison]::OrdinalIgnoreCase)) { $Name += '.png' }
		$destination = Join-Path $projectRoot (Join-Path 'release-artifacts\screenshots' $Name)
	}
	if ([IO.Path]::GetExtension($destination) -ne '.png') {
		Stop-Screenshot 'Output path must end in .png.' 'Choose a PNG filename.'
	}

	$adb = Resolve-AdbPath $projectRoot
	if (-not $adb) { Stop-Screenshot 'adb was not found in the Android SDK or PATH.' 'Install Android platform-tools or set ANDROID_HOME/ANDROID_SDK_ROOT.' }
	$deviceOutput = Invoke-Adb $adb @('devices', '-l')
	$devices = @()
	$unauthorized = @()
	foreach ($line in $deviceOutput) {
		if ($line -match '^([^\s]+)\s+([^\s]+)(?:\s+(.*))?$') {
			if ($Matches[2] -eq 'device') {
				$devices += [PSCustomObject]@{ Serial = $Matches[1]; Detail = $Matches[3] }
			} elseif ($Matches[2] -eq 'unauthorized') {
				$unauthorized += $Matches[1]
			}
		}
	}
	if ($unauthorized.Count -gt 0) {
		Stop-Screenshot "Unauthorized ADB device(s): $($unauthorized -join ', ')." 'Approve USB debugging on the device, then rerun.'
	}
	if ($devices.Count -ne 1) {
		Stop-Screenshot "Expected exactly one usable ADB device; found $($devices.Count)." 'Connect one device or disconnect the extra devices, then rerun.'
	}
	$serial = $devices[0].Serial

	$destinationDirectory = Split-Path -Parent $destination
	[IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
	$remotePath = '/sdcard/forestmusic-screen-' + [Guid]::NewGuid().ToString('N') + '.png'
	$remoteCreated = $false
	try {
		Invoke-Adb $adb @('-s', $serial, 'shell', 'screencap', '-p', $remotePath) | Out-Null
		$remoteCreated = $true
		Invoke-Adb $adb @('-s', $serial, 'pull', $remotePath, $destination) | ForEach-Object { Write-Host $_ }

		if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
			Stop-Screenshot "adb pull did not create $destination." 'Check device storage and the local destination.'
		}
		$bytes = [IO.File]::ReadAllBytes($destination)
		if ($bytes.Length -lt 24) { Stop-Screenshot 'The captured file is empty or too short to be a PNG.' 'Recapture after confirming the device display is available.' }
		$signature = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
		for ($i = 0; $i -lt $signature.Length; $i++) {
			if ($bytes[$i] -ne $signature[$i]) {
				Stop-Screenshot 'The captured file does not have a valid PNG signature.' 'Use the safe screencap-to-device-file then adb-pull workflow.'
			}
		}
		$width = [uint32](([uint64]$bytes[16] -shl 24) -bor ([uint64]$bytes[17] -shl 16) -bor ([uint64]$bytes[18] -shl 8) -bor [uint64]$bytes[19])
		$height = [uint32](([uint64]$bytes[20] -shl 24) -bor ([uint64]$bytes[21] -shl 16) -bor ([uint64]$bytes[22] -shl 8) -bor [uint64]$bytes[23])
		if ($width -eq 0 -or $height -eq 0) { Stop-Screenshot 'PNG IHDR dimensions are invalid.' 'Recapture and inspect the resulting image.' }
		if ($VerifyDimensions) { Write-Host ("PNG dimensions: " + $width + "x" + $height) }
		Write-Host "Screenshot: $destination"
		Write-Host "Bytes: $($bytes.Length)"
		Write-Host "Device: $serial ($($devices[0].Detail))"
	} finally {
		if ($remoteCreated) {
			try { Invoke-Adb $adb @('-s', $serial, 'shell', 'rm', '-f', $remotePath) | Out-Null } catch { Write-Warning 'Could not remove the unique temporary screenshot from device storage.' }
		}
	}
	if ($OpenFolder) { Start-Process explorer.exe -ArgumentList (Split-Path -Parent $destination) }
} catch {
	$message = $_.Exception.Message
	if ($message -match '^SCREENSHOT_STOP\|([^|]+)\|(.+)$') {
		Write-Host "STOP — $($Matches[1])"
		Write-Host "Next: $($Matches[2])"
	} else {
		Write-Host "STOP — $message"
	}
	exit 1
}
