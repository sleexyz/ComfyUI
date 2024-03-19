#!/usr/bin/env -S bun
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { RunPodContext, Pod, ensureActivePodIsLoaded as ensurePodStarted, refreshState, getRemoteFromPodRuntime, stopPodAndWait, getFirstPod, Remote, getSshCmd } from './runpod';
import * as dotenv from 'dotenv';

const env = {
  ...dotenv.parse(readFileSync('.env')),
  ...dotenv.parse(readFileSync('pod_config/.pod.env')), 
};

export async function loadActivePod(): Promise<Pod | null> {
  if (existsSync('.active_pod')) {
    const pod = JSON.parse(readFileSync('.active_pod').toString());
    console.log("Loaded active pod from .active_pod:", {id: pod.id, name: pod.name, on: pod.runtime !== null});
    return pod;
  }
  return null;
}

type OperationDict = Record<string, Operation>;

interface Operation {
  name: string;
  description: string;
  usage: string;
  requirePodStarted?: boolean;
  run: (ctx: RunPodContext, args: string[]) => Promise<void>;
}

if (!env.REMOTE_ROOT) {
  console.error("REMOTE_ROOT is not set. Exiting.");
  process.exit(1);
}
if (env.REMOTE_DIR) {
  console.error("REMOTE_DIR is deprecated. Use REMOTE_ROOT and WORKSPACE_NAME instead. Exiting.");
  process.exit(1);
}
if (!env.WORKSPACE_NAME) {
  console.error("WORKSPACE_NAME is not set. Exiting.");
  process.exit(1);
}
env.REMOTE_DIR = `${env.REMOTE_ROOT}/${env.WORKSPACE_NAME}`;

const operations: OperationDict = {
  start: {
    name: "start",
    description: "Start the pod and provision it",
    usage: "pod start",
    requirePodStarted: true,
    run: async (ctx: RunPodContext, args: string[]) => {
      if (!env.CLOUDFLARE_DEMO_KEY) {
        console.error("CLOUDFLARE_DEMO_KEY is not set. Exiting.");
        process.exit(1);
      }
      console.log("Provisioning the pod...");
      const result = await spawn(`${ctx.sshCmd} -t "CLOUDFLARE_DEMO_KEY=${env.CLOUDFLARE_DEMO_KEY} REMOTE_DIR=${env.REMOTE_DIR} REMOTE_ROOT=${env.REMOTE_ROOT} WORKSPACE_NAME=${env.WORKSPACE_NAME} bash -s" < pod_config/provision.sh`);
      if (result !== 0) {
        console.error("Provisioning failed. Exiting.");
        process.exit(1);
      }
      await spawn(`${ctx.sshCmd} -t "CLOUDFLARE_DEMO_KEY=${env.CLOUDFLARE_DEMO_KEY} REMOTE_DIR=${env.REMOTE_DIR} REMOTE_ROOT=${env.REMOTE_ROOT} bash -s" < pod/start_services.sh`);
    },
  },
  stop: {
    name: "stop",
    description: "Stop the pod",
    usage: "pod stop",
    requirePodStarted: false,
    run: async (ctx: RunPodContext, args: string[]) => {
      await stopPodAndWait(ctx);
      await spawn("rm .active_pod");
    },
  },
  ssh: {
    name: "ssh",
    description: "SSH into the pod",
    usage: "pod ssh [args]",
    requirePodStarted: true,
    run: async (ctx: RunPodContext, args: string[]) => {
      await spawn(`${ctx.sshCmd} ${args.join(" ")}`);
    },
  },
  dev: {
    name: "dev",
    description: "Watches files for changes and syncs them to the pod.",
    usage: "pod dev [args]",
    requirePodStarted: true,
    run: async (ctx: RunPodContext, args: string[]) => {
      await spawn(`SSH_CMD="${ctx.sshCmd}" REMOTE_ROOT="${env.REMOTE_ROOT}" REMOTE_DIR="${env.REMOTE_DIR}" pod/dev.sh ${args.join(" ")}`);
    },
  },
  sync: {
    name: "sync",
    description: "Syncs files to the pod.",
    usage: "pod sync [args]",
    requirePodStarted: true,
    run: async (ctx: RunPodContext, args: string[]) => {
      await spawn(`SSH_CMD="${ctx.sshCmd}" REMOTE_DIR="${env.REMOTE_DIR}" pod/sync.sh ${args.join(" ")}`);
    },
  },
  ranger: {
    name: "ranger",
    description: "Open ranger in the pod",
    usage: "pod ranger",
    requirePodStarted: true,
    run: async (ctx: RunPodContext, args: string[]) => {
      await spawn(`${ctx.sshCmd} -t "ranger ${env.REMOTE_DIR}"`);
    },
  },
  supervisorctl: {
    name: "supervisorctl",
    description: "Open supervisor in the pod",
    usage: "pod supervisorctl [args]",
    requirePodStarted: true,
    run: async (ctx: RunPodContext, args: string[]) => {
      await spawn(`${ctx.sshCmd} -t "supervisorctl -c ${env.REMOTE_ROOT}/supervisord.conf ${args.join(" ")}"`);
    },
  },
  pull: {
    name: "pull",
    description: "Pull files from the pod",
    usage: "pod pull <remote_source> <local_dest>",
    requirePodStarted: true,
    run: async (ctx: RunPodContext, args: string[]) => {
      const source = args[0];
      const dest = args[1];
      if (!source || !dest) {
        console.error("Usage: pod pull <remote_source> <local_dest>");
        console.error(`remote source is relative to REMOTE_DIR: ${env.REMOTE_DIR}`);
        process.exit(1);
      }
      console.log("Copying files from the pod...");
      await spawn(`scp -i ~/.ssh/id_ed25519 -r -P ${ctx.port} "${ctx.user}@${ctx.ip}:${env.REMOTE_DIR}/${source}" ${dest}`);
      return;
    },
  },
  push: {
    name: "push",
    description: "Push files to the pod",
    usage: "pod push <local_source> <remote_dest>",
    requirePodStarted: true,
    run: async (ctx: RunPodContext, args: string[]) => {
      const source = args[0];
      const dest = args[1];
      if (!source || !dest) {
        console.error("Usage: pod push <local_source> <remote_dest>");
        console.error(`remote dest is relative to REMOTE_DIR: ${env.REMOTE_DIR}`);
        process.exit(1);
      }
      console.log("Copying files to the pod...");
      await spawn(`scp -i ~/.ssh/id_ed25519 -r -P ${ctx.port} ${source} "${ctx.user}@${ctx.ip}:${env.REMOTE_DIR}/${dest}"`);
      return;
    },
  },
};

class RunPodContext {
  pods: null | Pod[];
  activePod: null | Pod;

  remoteOverride: Remote | null;

  constructor(env: Record<string, string>) {
    this.pods = null;
    this.activePod = null;
    if (env.POD_USER) {
      this.remoteOverride = {
        source: 'override',
        ip: env.POD_IP!,
        port: parseInt(env.POD_PORT!),
        user: env.POD_USER!,
      };
    }
  }

  get remote(): Remote | null {
    if (this.remoteOverride) {
      return this.remoteOverride;
    }
    if (this.activePod) {
      return getRemoteFromPodRuntime(this.activePod.runtime!);
    }
    return null
  }

  get sshCmd() {
    const remote = this.remote;
    if (!remote) {
      return null;
    }
    return `ssh ${remote.user}@${remote.ip} -p ${remote.port} -i ~/.ssh/id_ed25519`;
  }
  get ip() {
    return this.remote?.ip;
  }
  get port() {
    return this.remote?.port;
  }
  get user() {
    return this.remote?.user;
  }
}

async function main() {
  const ctx: RunPodContext = new RunPodContext(env);

  if (!ctx.remote) {
    ctx.activePod = await loadActivePod();
    if (!ctx.activePod) {
      console.error("No active pod found. Refreshing pod data from RunPod.");
      await refreshState(ctx);
      if (!getFirstPod(ctx)) {
        console.error("No pods found.");
        process.exit(1);
      }
    }
  }

  const op = process.argv[2];
  if (op in operations) {
    if (operations[op].requirePodStarted && ctx.remote?.source === 'runpod') {
      await ensurePodStarted(ctx);
      writeFileSync('.active_pod', JSON.stringify(ctx.activePod, null, 2));
      if (!ctx.activePod || !ctx.activePod.runtime) {
        console.error("No active pod found.");
        process.exit(1);
      }
    }
    await operations[op].run(ctx, process.argv.slice(3));
    return;
  } else {
    console.error("Usage: pod <operation> [args]");
    console.error("Available operations:");
    for (const op in operations) {
      console.error(`  ${op}: ${operations[op].description}`);
    }
  }
}

async function spawn(command: string) {
  return Bun.spawn(["sh", "-c", command], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  }).exited;
}

main().catch(console.error);