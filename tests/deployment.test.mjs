import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AirlineRankingStack } from '../infra/stack.ts';
import { DeploymentStack } from '../infra/deployment-stack.ts';

const output = mkdtempSync(join(tmpdir(), 'airline-deployment-'));
after(() => rmSync(output, { recursive: true, force: true }));
const app = new App({ outdir: output, context: { '@aws-cdk/core:defaultCrossStackReferences': 'strong' } });
const env = { region: 'eu-north-1' };
const application = new AirlineRankingStack(app, 'Application', { env });
const deployment = new DeploymentStack(app, 'Deployment', {
  env, website: application.website, distribution: application.distribution,
});
const template = Template.fromStack(deployment);

test('deployments queue and use only main from the project repository', () => {
  template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
    PipelineType: 'V2', ExecutionMode: 'QUEUED',
    Stages: [Match.objectLike({ Name: 'Source', Actions: [Match.objectLike({
      Configuration: Match.objectLike({ FullRepositoryId: 'kuosmark/airline-ranking', BranchName: 'main' }),
    })] }), Match.objectLike({ Name: 'Deploy' })],
  });
});

test('builds verify Free before installing or deploying and preserve explicit polling settings', () => {
  const [project] = Object.values(template.findResources('AWS::CodeBuild::Project'));
  assert.equal(project.Properties.TimeoutInMinutes, 30);
  assert.equal(project.Properties.ConcurrentBuildLimit, 1);
  const spec = JSON.parse(project.Properties.Source.BuildSpec);
  assert.equal(spec.phases.install.commands[0], 'test "$(aws freetier get-account-plan-state --query accountPlanType --output text)" = FREE');
  assert.equal(spec.phases.install['runtime-versions'].nodejs, 22);
  const commands = spec.phases.build.commands;
  assert.equal(commands[0], 'npm run check');
  assert.match(commands[2], /infra:deploy -- AirlineRanking -c isPollingEnabled="\$IS_POLLING_ENABLED"/);
  assert.match(commands[2], /--outputs-file cdk.out\/outputs.json/);
  assert.equal(commands[3], 'npm run infra:publish -- cdk.out/outputs.json');
  assert.equal(template.toJSON().Parameters.IsPollingEnabled.Default, 'false');
  assert.deepEqual(template.toJSON().Parameters.IsPollingEnabled.AllowedValues, ['true', 'false']);
});

test('artifacts and build logs expire after seven days without public bucket access', () => {
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    LifecycleConfiguration: { Rules: [Match.objectLike({ ExpirationInDays: 7 })] },
  });
  template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 7 });
});

test('deployment roles do not read secrets and direct website writes exclude backend objects', () => {
  const policies = Object.values(template.findResources('AWS::IAM::Policy'));
  const statements = policies.flatMap(policy => policy.Properties.PolicyDocument.Statement);
  assert.equal(JSON.stringify(statements).includes('ssm:GetParameter'), false);
  const assume = statements.find(statement => statement.Action === 'sts:AssumeRole');
  assert.ok(assume);
  assert.equal(assume.Resource.length, 2);
  assert.match(JSON.stringify(assume.Resource), /cdk-hnb659fds-deploy-role/);
  assert.match(JSON.stringify(assume.Resource), /cdk-hnb659fds-file-publishing-role/);
  const upload = statements.find(statement => statement.Action === 's3:PutObject');
  assert.ok(upload);
  assert.equal(upload.Resource.length, 3);
  for (const extension of ['html', 'js', 'css']) assert.match(JSON.stringify(upload.Resource), new RegExp(`/\\*\\.${extension}`));
  for (const prefix of ['codeconnections', 'codestar-connections']) {
    for (const [key, value] of [['FullRepositoryId', 'kuosmark/airline-ranking'], ['BranchName', 'main']]) {
      const restriction = statements.find(statement => statement.Effect === 'Deny' && statement.Action === `${prefix}:UseConnection` && statement.Condition.StringNotEquals[`${prefix}:${key}`] === value);
      assert.ok(restriction);
      assert.equal(restriction.Condition.Null[`${prefix}:${key}`], 'false');
    }
  }
});
