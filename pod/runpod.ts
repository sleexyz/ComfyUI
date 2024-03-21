#!/usr/bin/env -S bun

export interface Remote {
  ip: string;
  port: number;
  user: string;
  source: 'runpod' | 'override';
}

export interface Pod {
  id: string;
  name: string;
  runtime: PodRuntime | null;
}

export interface PodRuntime {
  uptimeInSeconds: number;
  ports: Array<{
    ip: string;
    isIpPublic: boolean;
    privatePort: number;
    publicPort: number;
    type: string;
  }>;
  gpus: Array<{
    id: string;
    gpuUtilPercent: number;
    memoryUtilPercent: number;
  }>;
  container: {
    cpuPercent: number;
    memoryPercent: number;
  };
};

const getPodsQuery = `
query Pods {
  myself {
    pods {
      id
      name
      runtime {
        uptimeInSeconds
        ports {
          ip
          isIpPublic
          privatePort
          publicPort
          type
        }
        gpus {
          id
          gpuUtilPercent
          memoryUtilPercent
        }
        container {
          cpuPercent
          memoryPercent
        }
      }
    }
  }
}`;

const endpoint = `https://api.runpod.io/graphql?api_key=${process.env.RUNPOD_API_KEY}`


async function getPods(): Promise<Pod[]> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: getPodsQuery })
  });
  const result = await response.json();
  if (result.errors || !response.ok) {
    console.error('Error fetching data:', result);
    process.exit(1);
  }
  console.log('Pods:', result.data.myself.pods);
  return result.data.myself.pods;
}

export interface RunPodContext {
  pods: Pod[] | null;
  activePod: Pod | null;
}

export function getFirstPod(ctx: RunPodContext): Pod | null {
  const pods = ctx.pods;
  if (!pods || pods.length === 0) {
    console.error('No pods found');
    return null;
  }
  if (pods.length > 1) {
    console.error('NOTE: More than one pod found, using the first one');
  }
  return pods[0];
}

export async function refreshState(ctx: RunPodContext): Promise<void> {
  ctx.pods = await getPods();
  const firstPod = getFirstPod(ctx);
  if (firstPod && firstPod.runtime) {
    ctx.activePod = firstPod;
  } else {
    delete ctx.activePod;
  }
}

export async function ensureActivePodIsLoaded(ctx: RunPodContext): Promise<void> {
  if (ctx.activePod) {
    return;
  }

  const firstPod = getFirstPod(ctx);
  if (!firstPod) {
    throw new Error('No pods found');
  }

  await startPod(firstPod.id);

  await retry({
    timeout: 2 * 60 * 1000, delay: 5000,
  }, async () => {
    await refreshState(ctx);
    if (ctx.activePod) {
      return;
    }
    throw new Error('Pod not started yet...');
  });
}

async function retry<T>(options: { timeout: number, delay?: number, customErrorMessage?: string}, fn: () => Promise<T>): Promise<T> {
  const { timeout, delay = 1000, customErrorMessage = `Error after trying ${options.n} times` } = options;
  let lastError;
  const endTime = Date.now() + timeout;
  while (Date.now() < endTime) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`Error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  if (customErrorMessage) {
    throw new Error(customErrorMessage);
  }
  throw lastError;
}


export function getRemoteFromPodRuntime(podRuntime: PodRuntime): Remote {
  const sshPort = podRuntime.ports.find((port) => port.privatePort === 22);
  if (!sshPort) {
    throw new Error('No SSH port found');
  }
  return {
    ip: sshPort.ip,
    port: sshPort.publicPort,
    user: 'root',
    source: 'runpod',
  };
}

function startPodMutation(podId: string) {
  return `mutation {
  podResume(input: {podId: ${JSON.stringify(podId)}, gpuCount: 1}) {
    id
    desiredStatus
    imageName
    env
    machineId
    machine {
      podHostId
    }
  }
}`;
}

async function startPod(podId: string): Promise<void> {
  const mutation = startPodMutation(podId);
  console.log(`Starting pod: ${podId}`);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: mutation })
  });
  const result = await response.json();
  if (result.errors || !response.ok) {
    console.error('Error fetching data:', result);
    process.exit(1);
  }
}


export async function stopPodAndWait(ctx: RunPodContext): Promise<void> {
  await stopPod(ctx);
  retry({
    timeout: 2 * 60 * 1000, delay: 5000,
  }, async () => {
    await refreshState(ctx);

    if (!ctx.activePod) {
      return;
    }
    throw new Error('Pod not stopped yet...');
  });
  console.log('Pod stopped');
}

async function stopPod(context: RunPodContext): Promise<void> {
  const activePod = context.activePod;
  if (!activePod) {
    throw new Error('No active pod to stop');
  }
  const stopPodMutation = `mutation {
  podStop(input: {podId: ${JSON.stringify(activePod.id)}}) {
    id
    desiredStatus
  }
}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: stopPodMutation })
  });
  const result = await response.json();
  if (result.errors || !response.ok) {
    console.error('Error fetching data:', result);
    process.exit(1);
  }
  console.log(`Stopping pod: ${activePod.id}`);
  return;
}

