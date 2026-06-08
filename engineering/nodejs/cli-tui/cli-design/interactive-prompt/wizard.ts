import * as p from '@clack/prompts';

async function main() {
  p.intro('🚀 Deployment Wizard');

  const project = await p.text({
    message: 'Project name?',
    placeholder: 'my-awesome-app',
    validate: (value) => {
      if (value.length < 2) return 'Project name must be at least 2 characters';
    },
  });

  if (p.isCancel(project)) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  const environment = await p.select({
    message: 'Select environment',
    options: [
      { value: 'dev', label: 'Development' },
      { value: 'staging', label: 'Staging' },
      { value: 'prod', label: 'Production', hint: 'Careful!' },
    ],
  });

  if (p.isCancel(environment)) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  const features = await p.multiselect({
    message: 'Select features to enable',
    options: [
      { value: 'caching', label: 'Redis Caching' },
      { value: 'queue', label: 'Background Jobs' },
      { value: 'metrics', label: 'Observability' },
    ],
    required: false,
  });

  const confirm = await p.confirm({
    message: `Deploy ${project} to ${environment} with ${(features as any)?.length || 0} features?`,
    initialValue: false,
  });

  if (!confirm) {
    p.cancel('Deployment cancelled');
    return;
  }

  const s = p.spinner();
  s.start('Deploying...');

  try {
    await new Promise((r) => setTimeout(r, 2000));
    s.stop('Deployed successfully!');
    p.outro(`✅ ${project} is live on ${environment}`);
  } catch (err: any) {
    s.stop(`Deployment failed: ${err.message}`);
    process.exit(1);
  }
}

main();
