import { Command } from 'commander';
import { z } from 'zod';

const program = new Command();

program
  .name('deploy-cli')
  .description('Deployment automation CLI')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy application')
  .argument('<environment>', 'target environment')
  .option('-t, --tag <tag>', 'docker image tag', 'latest')
  .option('--dry-run', 'simulate without actual deployment', false)
  .option('-r, --regions <regions...>', 'target regions', ['us-east-1'])
  .action(async (environment, options) => {
    const schema = z.object({
      tag: z.string(),
      dryRun: z.boolean(),
      regions: z.array(z.string()),
    });

    const parsed = schema.parse(options);
    console.log(`Deploying to ${environment} with tag ${parsed.tag}`);
    console.log(`Regions: ${parsed.regions.join(', ')}`);
    if (parsed.dryRun) console.log('(dry run)');
  });

program
  .command('rollback')
  .description('Rollback deployment')
  .argument('<environment>', 'target environment')
  .option('--to <version>', 'rollback target version')
  .action(async (environment, options) => {
    console.log(`Rolling back ${environment} to ${options.to || 'previous'}`);
  });

if (require.main === module) {
  program.parse();
}

export { program };
