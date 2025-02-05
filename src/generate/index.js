import { assertBedrockRoot } from '../util/dir';
import { queueTask, runTasks } from '../util/tasks';
import { setResourceOptions } from './util/options';

import { generateModel, assertModelsDir } from './model';
import { generateRoutes, assertRoutesDir } from './routes';
import { generateModal, assertModalsDir } from './modals';
import { generateDocs, assertApiDocsDir, assertWebDocsDir } from './docs';
import { generateScreens, generateSubscreens, promptScreensDir } from './screens';

export default async function generate(options, command) {
  await assertBedrockRoot();

  await setResourceOptions(options, command);

  const { components, resources } = options;

  // Running as tasks means we need to assert paths up
  // front to allow prompts if necessary and prime the cache.
  // Note that routes are generated from models and docs from
  // routes so we can't run in parallel here.

  if (components.includes('model')) {
    await assertModelsDir();
  }
  if (components.includes('routes')) {
    await assertRoutesDir();
  }
  if (components.includes('docs')) {
    await assertApiDocsDir();
    await assertWebDocsDir();
  }
  if (components.includes('screens') || components.includes('subscreens')) {
    // Often admin/screens is a pattern so need to prompt
    await promptScreensDir(options);
  }
  if (components.includes('modal')) {
    await assertModalsDir();
  }
  for (let resource of resources) {
    queueTask(`Generate ${resource.name} Resources`, async () => {
      if (components.includes('model')) {
        queueTask('Model', async () => {
          await generateModel(resource, options);
        });
      }
      if (components.includes('routes')) {
        queueTask('Routes', async () => {
          await generateRoutes(resource, options);
        });
      }
      if (components.includes('docs')) {
        queueTask('Docs', async () => {
          await generateDocs(resource, options);
        });
      }
      if (components.includes('screens')) {
        queueTask('Screens', async () => {
          await generateScreens(resource, options);
        });
      }
      if (components.includes('subscreens')) {
        queueTask('Subscreens', async () => {
          await generateSubscreens(resource, options);
        });
      }
      if (components.includes('modal')) {
        queueTask('Modal', async () => {
          await generateModal(resource, options);
        });
      }
    });
  }

  await runTasks();
}

export function model(options) {
  generate({
    ...options,
    components: ['model'],
  });
}

export function routes(options) {
  generate({
    ...options,
    components: ['routes'],
  });
}

export function docs(options) {
  generate({
    ...options,
    components: ['docs'],
  });
}

export function screens(options) {
  generate({
    ...options,
    components: ['screens'],
  });
}

export function subscreens(options) {
  generate({
    ...options,
    components: ['subscreens'],
  });
}

export function modal(options) {
  generate({
    ...options,
    components: ['modal'],
  });
}
