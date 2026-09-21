import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ChooseDirectoryOptions = {
  defaultPath?: string;
};

export function appleScriptChooseFolder(prompt: string, defaultPath?: string): string {
  const escaped = prompt.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  if (defaultPath?.trim()) {
    const escapedPath = defaultPath.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    return `POSIX path of (choose folder with prompt "${escaped}" default location POSIX file "${escapedPath}")`;
  }
  return `POSIX path of (choose folder with prompt "${escaped}")`;
}

export async function chooseNativeDirectory(
  prompt: string,
  options: ChooseDirectoryOptions = {},
): Promise<string | undefined> {
  const defaultPath = options.defaultPath?.trim();
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("osascript", ["-e", appleScriptChooseFolder(prompt, defaultPath)]);
      const path = stdout.trim().replace(/\/$/, "");
      return path || undefined;
    } catch {
      return undefined;
    }
  }
  if (process.platform === "linux") {
    try {
      const args = ["--file-selection", "--directory", `--title=${prompt}`];
      if (defaultPath) {
        args.push(`--filename=${defaultPath.endsWith("/") ? defaultPath : `${defaultPath}/`}`);
      }
      const { stdout } = await execFileAsync("zenity", args);
      const path = stdout.trim();
      return path || undefined;
    } catch {
      return undefined;
    }
  }
  if (process.platform === "win32") {
    try {
      const selected = defaultPath ? `$d.SelectedPath = '${defaultPath.replaceAll("'", "''")}'\n` : "";
      const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = '${prompt.replaceAll("'", "''")}'
${selected}if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }
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
