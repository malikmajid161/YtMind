import { spawn } from "node:child_process";
const child = spawn(
  process.env.YTMIND_PYTHON || "python",
  [
    "-m",
    "pip",
    "install",
    "--target",
    "artifacts/media-tools",
    "yt-dlp==2026.8.19",
    "imageio-ffmpeg==0.6.0",
    "--disable-pip-version-check",
  ],
  { stdio: "inherit", windowsHide: true },
);
child.on("exit", (code) => (process.exitCode = code || 0));
child.on("error", () => {
  console.error(
    "Python 3.10+ is needed for the local media helper. Set YTMIND_PYTHON to its executable.",
  );
  process.exitCode = 1;
});
