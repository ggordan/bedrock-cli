import path from 'path';
import kleur from 'kleur';
import { exit } from '../util/exit';
import { exec } from '../util/shell';
import { readFile } from '../util/file';

export async function getConfig(environment) {
  const configFilePath = path.resolve('deployment/environments', environment, 'config.json');
  let config = {};
  try {
    config = await readFile(configFilePath);
  } catch (e) {
    exit(
      `Could not find config.json for environment: "${environment}", file path: "${configFilePath}"`
    );
  }
  return config;
}

export async function setGCloudConfig(options) {
  const { project, computeZone, kubernetes } = options;
  if (!kubernetes) exit('Missing kubernetes settings in config');
  try {
    // gcloud returns output on stderr
    if (!project) exit('Missing project');
    console.log(await exec(`gcloud config set project ${project}`, 'stderr'));

    if (!computeZone) exit('Missing computeZone');
    console.info(await exec(`gcloud config set compute/zone ${computeZone}`, 'stderr'));

    const { clusterName } = kubernetes;
    if (!clusterName) exit('Missing kubernetes.clusterName');

    console.info(await exec(`gcloud container clusters get-credentials ${clusterName}`, 'stderr'));
    console.info(await exec(`gcloud config set container/cluster ${clusterName}`, 'stderr'));
  } catch (e) {
    exit(e.message);
  }
}

async function checkGCloudConfig(environment, options) {
  const { project, computeZone, kubernetes } = options;
  if (!kubernetes) exit('Missing kubernetes settings in config');
  try {
    let valid = true;
    if (!project) exit('Missing project');
    const currentProject = await exec('gcloud config get-value project');
    if (project != currentProject) {
      valid = false;
      console.info(
        kleur.red(`Invalid Google Cloud config (use authorize script): project = ${currentProject}`)
      );
    }

    if (!computeZone) exit('Missing computeZone');
    const currentComputeZone = await exec('gcloud config get-value compute/zone');
    if (computeZone != currentComputeZone) {
      valid = false;
      console.info(
        kleur.red(
          `Invalid Google Cloud config (use authorize script): compute/zone = ${currentComputeZone}`
        )
      );
    }

    const { clusterName } = kubernetes;
    if (!clusterName) exit('Missing kubernetes.clusterName');
    const currentClusterName = await exec('gcloud config get-value container/cluster');
    if (clusterName != currentClusterName) {
      valid = false;
      console.info(
        kleur.red(
          `Invalid Google Cloud config (use authorize script): container/cluster = ${currentClusterName}`
        )
      );
    }

    // TODO: add check for secrets folder: deployment/environments/$ENVIRONMENT/secrets

    console.info(
      kleur.green(
        `Using Google Cloud environment ${environment} (project=${project}, compute/zone=${computeZone}, cluster=${clusterName})`
      )
    );

    // TODO: add optional fallback to authorize current values

    return valid;
  } catch (e) {
    exit(e.message);
  }
}

export async function checkConfig(environment, config) {
  const valid = await checkGCloudConfig(environment, config.gcloud);
  if (!valid) exit('Invalid Google Cloud config');
}
