import { execFile } from 'child_process';
import { platform } from 'os';
import { promisify } from 'util';
import log from 'electron-log';

const execFileAsync = promisify(execFile);

export interface ActiveWindow {
  title: string;
  owner: {
    name: string;
    path?: string;
  };
}

/**
 * AppleScript to get the active window on macOS
 * Security Note: This script is passed as an argument to osascript, not through shell evaluation.
 * This prevents shell injection attacks since the script content is never parsed by the shell.
 */
const MAC_SCRIPT = `
global frontApp, frontAppName, windowTitle

set windowTitle to ""
tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set frontAppName to name of frontApp
    tell process frontAppName
        try
            set windowTitle to name of front window
        end try
    end tell
end tell

return frontAppName & "|||" & windowTitle
`;

/**
 * PowerShell script to get the active window on Windows
 * Security Note: This script is passed as an argument to powershell, not evaluated as a shell command.
 * Using execFile() with argument arrays prevents shell injection attacks by avoiding string interpolation.
 */
const WINDOWS_SCRIPT = `
$code = @'
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
'@

Add-Type $code -Name Utils -Namespace Win32 -MemberDefinition "[DllImport(""user32.dll"")] public static extern IntPtr GetForegroundWindow(); [DllImport(""user32.dll"")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); [DllImport(""user32.dll"")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);" -PassThru | Out-Null

$hwnd = [Win32.Utils]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[Win32.Utils]::GetWindowText($hwnd, $sb, 256) | Out-Null
$title = $sb.ToString()

$pidOut = 0
[Win32.Utils]::GetWindowThreadProcessId($hwnd, [ref]$pidOut) | Out-Null
$process = Get-Process -Id $pidOut
$appName = $process.ProcessName

Write-Output "$appName|||$title"
`;

/**
 * Get the currently active window information
 */
export async function getActiveWindow(): Promise<ActiveWindow | undefined> {
  try {
    const currentPlatform = platform();

    if (currentPlatform === 'darwin') {
      return await getMacActiveWindow();
    } else if (currentPlatform === 'win32') {
      return await getWindowsActiveWindow();
    } else {
      log.warn(`Active window detection not supported on platform: ${currentPlatform}`);
      return undefined;
    }
  } catch (error) {
    log.error('Failed to get active window:', error);
    return undefined;
  }
}

/**
 * Get active window on macOS using AppleScript
 * Security: execFile() passes the script as a separate argument, preventing shell injection.
 * Unlike exec(), the script is NOT parsed by the shell, eliminating injection vulnerabilities.
 */
async function getMacActiveWindow(): Promise<ActiveWindow> {
  const { stdout } = await execFileAsync('osascript', ['-e', MAC_SCRIPT], { timeout: 3000 });
  const [appName, windowTitle] = stdout.trim().split('|||');

  return {
    title: windowTitle || '',
    owner: {
      name: appName || 'Unknown',
    },
  };
}

/**
 * Get active window on Windows using PowerShell
 * Security: execFile() passes the script as a separate argument, preventing shell injection.
 * The script is passed as an argument array, not through shell string interpolation.
 */
async function getWindowsActiveWindow(): Promise<ActiveWindow> {
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', WINDOWS_SCRIPT], { timeout: 3000 });
  const [appName, windowTitle] = stdout.trim().split('|||');

  return {
    title: windowTitle || '',
    owner: {
      name: appName || 'Unknown',
    },
  };
}

/**
 * Get and log the currently focused window information
 * Used for developement, debugging and logging purposes
 */
export async function logFocusedWindowInfo(): Promise<void> {
  try {
    const windowInfo = await getActiveWindow();
    if (windowInfo) {
      const infoString = `📍 Active Window: [${windowInfo.owner.name}] - "${windowInfo.title}"`;
      log.info(infoString);

    } else {
      log.warn('Could not detect active window');
    }
  } catch (error) {
    log.error('❌ Error logging window info:', error);
  }
}

