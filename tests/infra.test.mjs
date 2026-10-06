import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AirlineRankingStack } from '../infra/stack.ts';

const output = mkdtempSync(join(tmpdir(), 'airline-infra-'));
after(() => rmSync(output, { recursive: true, force: true }));
const app = new App({ outdir: output });
const stack = new AirlineRankingStack(app, 'Test', { env: { region: 'eu-north-1' } });
const template = Template.fromStack(stack);

test('polling starts disabled with bounded concurrency, execution time and no automatic retries', () => {
  template.hasResourceProperties('AWS::Scheduler::Schedule', {
    State: 'DISABLED', ScheduleExpression: 'rate(15 minutes)',
    FlexibleTimeWindow: { Mode: 'OFF' },
    Target: Match.objectLike({
      Input: '{"scheduledAt":"<aws.scheduler.scheduled-time>"}',
      RetryPolicy: { MaximumEventAgeInSeconds: 60, MaximumRetryAttempts: 0 },
    }),
  });
  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs22.x', Architectures: ['arm64'], MemorySize: 256,
    Timeout: 120, ReservedConcurrentExecutions: 1,
    Environment: { Variables: Match.objectLike({ SKYLINK_KEY_PARAMETER: '/airline-ranking/skylink-api-key' }) },
  });
  template.hasResourceProperties('AWS::Lambda::EventInvokeConfig', {
    MaximumRetryAttempts: 0, MaximumEventAgeInSeconds: 60,
  });
  template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 7 });
});

test('state stays private and survives stack removal with bounded version history', () => {
  const buckets = Object.values(template.findResources('AWS::S3::Bucket'));
  assert.equal(buckets.length, 2);
  for (const bucket of buckets) {
    assert.equal(bucket.DeletionPolicy, 'Retain');
    assert.equal(bucket.UpdateReplacePolicy, 'Retain');
    assert.deepEqual(bucket.Properties.PublicAccessBlockConfiguration, {
      BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
    });
  }
  template.hasResourceProperties('AWS::S3::Bucket', {
    VersioningConfiguration: { Status: 'Enabled' },
    LifecycleConfiguration: { Rules: [Match.objectLike({ NoncurrentVersionExpiration: { NoncurrentDays: 7 } })] },
  });
});

test('CloudFront uses authenticated S3 access and honors freshness headers without an HTML error fallback', () => {
  template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
    OriginAccessControlConfig: Match.objectLike({ SigningBehavior: 'always', SigningProtocol: 'sigv4' }),
  });
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      DefaultRootObject: 'index.html', PriceClass: 'PriceClass_100',
      DefaultCacheBehavior: Match.objectLike({ AllowedMethods: ['GET', 'HEAD'], ViewerProtocolPolicy: 'redirect-to-https' }),
      CustomErrorResponses: [{ ErrorCode: 403, ErrorCachingMinTTL: 0 }, { ErrorCode: 404, ErrorCachingMinTTL: 0 }],
    }),
  });
  template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
    CachePolicyConfig: Match.objectLike({ MinTTL: 0, DefaultTTL: 30, MaxTTL: 31536000 }),
  });
});

test('the refresh role can access only its state objects, published ranking and API-key parameter', () => {
  const policies = Object.values(template.findResources('AWS::IAM::Policy'));
  const policy = policies.find(resource => resource.Properties.PolicyDocument.Statement.some(statement =>
    Array.isArray(statement.Action) && statement.Action.includes('s3:GetObject')));
  assert.ok(policy);
  const statements = policy.Properties.PolicyDocument.Statement;
  assert.equal(statements.length, 3);
  const [state, ranking, key] = statements;
  assert.deepEqual(state.Action, ['s3:GetObject', 's3:PutObject']);
  assert.equal(state.Resource.length, 2);
  assert.match(JSON.stringify(state.Resource[0]), /\/operator-names\.json/);
  assert.match(JSON.stringify(state.Resource[1]), /\/refresh-state\.json/);
  assert.equal(ranking.Action, 's3:PutObject');
  assert.match(JSON.stringify(ranking.Resource), /\/api\/ranking/);
  assert.equal(key.Action, 'ssm:GetParameter');
  assert.match(JSON.stringify(key.Resource), /parameter\/airline-ranking\/skylink-api-key/);
  for (const statement of statements) assert.equal(JSON.stringify(statement.Resource).includes('*'), false);
});

test('refresh failures notify the deployment-supplied email', () => {
  template.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: { Ref: 'AlertEmail' } });
  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    Namespace: 'AWS/Lambda', MetricName: 'Errors', Period: 900, Threshold: 1,
    EvaluationPeriods: 1, TreatMissingData: 'notBreaching', AlarmActions: [Match.anyValue()],
  });
});

test('polling must be explicitly enabled and other Regions are rejected', () => {
  const enabledApp = new App({ outdir: join(output, 'enabled'), context: { isPollingEnabled: 'true' } });
  const enabled = new AirlineRankingStack(enabledApp, 'Enabled', { env: { region: 'eu-north-1' } });
  Template.fromStack(enabled).hasResourceProperties('AWS::Scheduler::Schedule', { State: 'ENABLED' });
  assert.throws(() => new AirlineRankingStack(new App(), 'WrongRegion', { env: { region: 'eu-west-1' } }), /eu-north-1/);
  const invalidApp = new App({ context: { isPollingEnabled: 'yes' } });
  assert.throws(() => new AirlineRankingStack(invalidApp, 'Invalid', { env: { region: 'eu-north-1' } }), /true or false/);
});
