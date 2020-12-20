import { green, yellow } from 'kleur';
import { exit } from '../util/exit';
import { prompt } from '../util/prompt';
import { exec, execSyncInherit } from '../util/shell';
import { writeConfig, readServiceYaml, writeServiceYaml } from './utils';
import { checkTerraformCommand } from './provision/index';

export async function bootstrapProjectEnvironment(project, environment, config) {
  await checkTerraformCommand();

  let activeAccount = '';
  try {
    activeAccount = await exec('gcloud config get-value account');
    if (!activeAccount) throw new Error('No activeAccount');
  } catch (e) {
    exit('There is no active glcoud account. Please login to glcloud first. Run: "bedrock cloud login"');
  }

  try {
    await exec(`gcloud projects describe ${project} --format json`);
  } catch (e) {
    exit(
      `Error: No access for user [${activeAccount}] or unknown project [${project}] (Perhaps you need to login first: "bedrock cloud login")`
    );
  }

  console.info(green(`Verified Google Cloud project [${project}] for environment [${environment}]`));

  const { gcloud } = config;
  if (!gcloud) exit(`Missing gcloud in config.json for environment [${environment}]`);
  if (!gcloud.project) exit(`Missing gcloud.project in config.json for environment [${environment}]`);
  if (project != gcloud.project) {
    let confirmed = await prompt({
      type: 'confirm',
      name: 'open',
      message: `Project [${project}] is different from project [${gcloud.project}] as defined in config.json. Your config.json will be updated, do you want to continue?`,
      initial: true,
    });
    if (!confirmed) process.exit(0);
    const updatedConfig = { ...config };
    if (config.gcloud.bucketPrefix == config.gcloud.project) {
      updatedConfig.gcloud.bucketPrefix = project;
    }
    updatedConfig.gcloud.project = project;
    writeConfig(environment, updatedConfig);
  }

  console.info(yellow('=> Updating gcloud config project'));
  await execSyncInherit(`gcloud config set project ${project}`);
  console.info(yellow('=> Enabling Compute services (This can take a couple of minutes)'));
  await execSyncInherit('gcloud services enable compute.googleapis.com');
  console.info(yellow('=> Enabling Kubernetes services'));
  await execSyncInherit('gcloud services enable container.googleapis.com');

  const { computeZone } = gcloud;
  // computeZone example: us-east1-c
  const region = computeZone.slice(0, -2); // e.g. us-east1

  console.info(yellow('=> Configure loadbalancers'));
  await configureServiceLoadBalancer(environment, 'api', region);
  await configureServiceLoadBalancer(environment, 'web', region);

  console.info(yellow('=> Configure deployment GCR paths'));
  configureDeploymentGCRPath(environment, 'api', project);
  configureDeploymentGCRPath(environment, 'api-cli', project);
  configureDeploymentGCRPath(environment, 'api-jobs', project);
  configureDeploymentGCRPath(environment, 'web', project);
}

async function configureServiceLoadBalancer(environment, service, region) {
  let addressIP;
  try {
    const addressJSON = await exec(`gcloud compute addresses describe --region ${region} ${service} --format json`);
    addressIP = JSON.parse(addressJSON).address;
  } catch (e) {
    console.info(yellow(`Creating ${service.toUpperCase()} address`));
    await execSyncInherit(`gcloud compute addresses create ${service} --region ${region}`);
    const addressJSON = await exec(`gcloud compute addresses describe --region ${region} ${service} --format json`);
    addressIP = JSON.parse(addressJSON).address;

    // Update service yml file
    const fileName = `${service}-service.yml`;
    const serviceYaml = readServiceYaml(environment, fileName);
    console.info(yellow(`=> Updating ${fileName}`));
    serviceYaml.spec.loadBalancerIP = addressIP;
    writeServiceYaml(environment, fileName, serviceYaml);
    console.info(serviceYaml);
  }
  console.info(green(`${service.toUpperCase()} service loadBalancerIP: ${addressIP}`));
}

async function configureDeploymentGCRPath(environment, service, project) {
  // Update deployment yml file
  const fileName = `${service}-deployment.yml`;
  const serviceYaml = readServiceYaml(environment, fileName);

  const image = serviceYaml.spec.template.spec.containers[0].image;
  const newImage = image.replace(/gcr\.io\/.*\//, `gcr.io/${project}/`);
  console.info(green(newImage));

  if (image != newImage) {
    console.info(yellow(`=> Updating ${fileName}`));
    serviceYaml.spec.template.spec.containers[0].image = newImage;
    writeServiceYaml(environment, fileName, serviceYaml);
  }
}
