import { exec } from './shell';

export async function cloneRepository(dir, repo) {
  await exec(`git clone git@github.com:${repo}.git ${dir}`);
}

export async function initializeRepository(dir, repo) {
  const commands = ['git init', 'git add .', 'git commit -m "Initial Commit"'];
  if (repo) {
    commands.push(`git remote add origin git@github.com:${repo}.git`);
  }
  await exec(commands);
}
