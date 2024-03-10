#!/usr/bin/env -S bun

interface PodRuntime {
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

const query = `
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

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query })
});

const result = await response.json();

if (result.errors || !response.ok) {
  console.error('Error fetching data:', result);
  process.exit(1);
}

const pods = result.data.myself.pods;
if (pods.length === 0) {
  console.error('No pods found');
  process.exit(1);
}
if (pods.length > 1) {
  console.error('NOTE: More than one pod found, using the first one');
}
const firstPodRuntime = result.data.myself.pods[0].runtime as PodRuntime;
const sshPort = firstPodRuntime.ports.find((port) => port.privatePort === 22);

console.log(`ssh root@${sshPort?.ip} -p ${sshPort?.publicPort} -i ~/.ssh/id_ed25519`)

export { };
