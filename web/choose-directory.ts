import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function chooseNativeDirectory(prompt: string): Promise<string | undefined> {
  if (process.platform === "darwin") {
    try {
      const escaped = prompt.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        `POSIX path of (choose folder with prompt "${escaped}")`,
      ]);
      const path = stdout.trim().replace(/\/$/, "");
      return path || undefined;
    } catch {
      return undefined;
    }
  }
  if (process.platform === "linux") {
    try {
      const { stdout } = await execFileAsync("zenity", ["--file-selection", "--directory", `--title=${prompt}`]);
      const path = stdout.trim();
      return path || undefined;
    } catch {
      return undefined;
    }
  }
  if (process.platform === "win32") {
    try {
      const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = '${prompt.replaceAll("'", "''")}'
if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }
`;
      const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
      const path = stdout.trim();
      return path || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
