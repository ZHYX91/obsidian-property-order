import { execFile } from "node:child_process";
import { promisify } from "node:util";

const runProcess = promisify(execFile);

export async function assertLocalTagPointsToHead(releaseTag, run = runProcess) {
  const reference = `refs/tags/${releaseTag}`;
  const { stdout: headOutput } = await run("git", ["rev-parse", "--verify", "HEAD"]);
  const head = headOutput.trim();

  try {
    await run("git", ["show-ref", "--verify", "--quiet", reference]);
  } catch (error) {
    if (isExitCode(error, 1)) return;
    throw error;
  }

  let taggedCommit;
  try {
    const { stdout } = await run("git", ["rev-parse", "--verify", `${reference}^{commit}`]);
    taggedCommit = stdout.trim();
  } catch (error) {
    throw new Error(`Existing tag ${releaseTag} does not resolve to a commit`, { cause: error });
  }
  if (taggedCommit !== head) {
    throw new Error(`Existing tag ${releaseTag} points to another commit`);
  }
}

function isExitCode(error, expected) {
  return typeof error === "object" && error !== null && "code" in error && error.code === expected;
}
