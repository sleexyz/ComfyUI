#!/usr/bin/env -S bun
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Context, Pod, ensureActivePodIsLoaded as ensurePodStarted, refreshState, getSSHCommand, stopPodAndWait, getFirstPod } from './get_ssh_command';


async function loadActivePod(): Promise<Pod | null> {
  if (existsSync('.active_pod')) {
    const pod = JSON.parse(readFileSync('.active_pod').toString());
    console.log("Loaded active pod from .active_pod:", {id: pod.id, name: pod.name, on: pod.runtime !== null});
    return pod;
  }
  return null;
}

async function main() {
  const ctx: Context = {
    pods: null,
    activePod: null
  };

  ctx.activePod = await loadActivePod();

  if (!ctx.activePod) {
    console.error("No active pod found. Refreshing pod data from RunPod.");
    await refreshState(ctx);
    if (!getFirstPod(ctx)) {
      console.error("No pods found.");
      process.exit(1);
    }
  }

  if (process.argv.includes("--stop")) {
    if (!ctx.activePod) {
      console.error("No active pod found. Nothing to stop.");
      process.exit(1);
    }
    await stopPodAndWait(ctx);
    await spawn("(rm .ssh_cmd; rm .active_pod)");
    process.exit(0);
  }

  await ensurePodStarted(ctx);
  const sshCmd = getSSHCommand(ctx.activePod!.runtime!);
  writeFileSync('.active_pod', JSON.stringify(ctx.activePod));
  writeFileSync('.ssh_cmd', sshCmd);

  if (!ctx.activePod || !ctx.activePod.runtime) {
    console.error("No active pod found.");
    process.exit(1);
  }

  if (!existsSync('.cloudflare_demo_key')) {
    console.error(".cloudflare_demo_key is not set");
    process.exit(1);
  }

  // Assuming cleanup is meant to be called at the end or on process exit
  process.on('exit', () => {
    console.error(`
**********
cloudflared is still running in the background.
Run 'supervisorctl stop cloudflared' to stop it.
Run 'supervisorctl start cloudflared' to start it.
Run 'supervisorctl restart cloudflared' to restart it.
**********
    `);
  });
  const CLOUDFLARE_DEMO_KEY = readFileSync('.cloudflare_demo_key').toString().trim();
  const SDXL = process.env.SDXL || "false";

  if (process.argv[2] !== "--no_provision") {
    console.log("Provisioning the pod...");
    await spawn(`${sshCmd} -t "CLOUDFLARE_DEMO_KEY=${CLOUDFLARE_DEMO_KEY} SDXL=${SDXL} bash -s" < provisioning/provision.sh`);
  }

  console.log("Restarting cloudflared...")
  await spawn(`${sshCmd} -t "supervisorctl restart cloudflared & supervisorctl tail -f cloudflared stderr & supervisorctl tail -f cloudflared stdout"`);
}

async function spawn(command: string) {
  return Bun.spawn(["sh", "-c", command], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  }).exited;
}

main().catch(console.error);