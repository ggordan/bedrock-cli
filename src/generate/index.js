import { assertBedrockRoot } from '../util/dir';
import { queueTask, runTasks } from '../util/tasks';
import { setResourceOptions } from './util/options';

import { generateModel, assertModelsDir } from './model';
import { generateRoutes, assertRoutesDir } from './routes';
import { generateModal, assertModalsDir } from './modals';
import { generateDocs, assertApiDocsDir, assertWebDocsDir } from './docs';
import { generateScreens, generateSubScreens, assertScreensDir } from './screens';
import { patchMainMenu, assertHeaderPath } from './util/patch';

export default async function generate(options) {
  await assertBedrockRoot();

  if (!options.resources) {
    await setResourceOptions(options);
  }

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
  if (components.includes('screens')) {
    await assertScreensDir();
  }
  if (components.includes('subscreens')) {
    await assertScreensDir();
  }
  if (components.includes('modal')) {
    await assertModalsDir();
  }
  if (resources.some((r) => r.menu)) {
    await assertHeaderPath();
  }

  for (let resource of resources) {
    queueTask(`Generate ${resource.name} Resources`, async () => {
      if (components.includes('model')) {
        queueTask('Model', async () => {
          await generateModel(resource);
        });
      }
      if (components.includes('routes')) {
        queueTask('Routes', async () => {
          await generateRoutes(resource);
        });
      }
      if (components.includes('docs')) {
        queueTask('Docs', async () => {
          await generateDocs(resource);
        });
      }
      if (components.includes('screens')) {
        queueTask('Screens', async () => {
          await generateScreens(resource);
        });
      }
      if (components.includes('subscreens')) {
        queueTask('Subscreens', async () => {
          await generateSubScreens(resource);
        });
      }
      if (components.includes('modal')) {
        queueTask('Modal', async () => {
          await generateModal(resource);
        });
      }
      if (resource.menu) {
        queueTask('Main Menu', async () => {
          await patchMainMenu(resource);
        });
      }
    });
  }

  await runTasks();
}
