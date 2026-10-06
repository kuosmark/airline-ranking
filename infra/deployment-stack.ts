import { ArnFormat, CfnParameter, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { IDistribution } from 'aws-cdk-lib/aws-cloudfront';

interface DeploymentProps extends StackProps {
  website: s3.IBucket;
  distribution: IDistribution;
}

export class DeploymentStack extends Stack {
  constructor(scope: Construct, id: string, props: DeploymentProps) {
    super(scope, id, props);
    if (props.env?.region !== 'eu-north-1') { throw new Error('Deploy only in eu-north-1'); }
    const connection = new CfnParameter(this, 'ConnectionArn', {
      type: 'String', description: 'Authorized GitHub CodeConnections connection in Stockholm.',
      allowedPattern: 'arn:aws:codeconnections:eu-north-1:[0-9]{12}:connection/[a-zA-Z0-9-]+',
    });
    const alertEmail = new CfnParameter(this, 'AlertEmail', {
      type: 'String', description: 'Email passed to the application refresh-failure alarm.',
      allowedPattern: '[^\\s@]+@[^\\s@]+\\.[^\\s@]+',
    });
    const isPollingEnabled = new CfnParameter(this, 'IsPollingEnabled', {
      type: 'String', default: 'false', allowedValues: ['true', 'false'],
      description: 'Enable only after migrating state and storing the API key.',
    });
    const artifacts = new s3.Bucket(this, 'Artifacts', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED, removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ expiration: Duration.days(7) }],
    });
    const buildLogs = new logs.LogGroup(this, 'BuildLogs', {
      retention: logs.RetentionDays.ONE_WEEK, removalPolicy: RemovalPolicy.DESTROY,
    });
    const build = new codebuild.PipelineProject(this, 'Deploy', {
      environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_7_0, computeType: codebuild.ComputeType.SMALL },
      timeout: Duration.minutes(30), concurrentBuildLimit: 1,
      logging: { cloudWatch: { logGroup: buildLogs } },
      environmentVariables: {
        ALERT_EMAIL: { value: alertEmail.valueAsString },
        IS_POLLING_ENABLED: { value: isPollingEnabled.valueAsString },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: { 'runtime-versions': { nodejs: 22 }, commands: [
            'test "$(aws freetier get-account-plan-state --query accountPlanType --output text)" = FREE',
            'npm ci',
          ] },
          build: { commands: [
            'npm run check',
            'npm run infra:diff -- AirlineRanking -c isPollingEnabled="$IS_POLLING_ENABLED"',
            'npm run infra:deploy -- AirlineRanking -c isPollingEnabled="$IS_POLLING_ENABLED" --parameters AlertEmail="$ALERT_EMAIL" --require-approval never --outputs-file cdk.out/outputs.json',
            'npm run infra:publish -- cdk.out/outputs.json',
          ] },
        },
      }),
    });
    build.addToRolePolicy(new iam.PolicyStatement({ actions: ['freetier:GetAccountPlanState'], resources: ['*'] }));
    // CDK uses these existing bootstrap roles to publish assets and deploy CloudFormation.
    const bootstrapRoles = ['deploy', 'file-publishing'].map(role => this.formatArn({
      service: 'iam', region: '', resource: 'role', arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
      resourceName: `cdk-hnb659fds-${role}-role-${this.account}-${this.region}`,
    }));
    build.addToRolePolicy(new iam.PolicyStatement({ actions: ['sts:AssumeRole'], resources: bootstrapRoles }));
    build.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'], resources: ['*.html', '*.js', '*.css'].map(key => props.website.arnForObjects(key)),
    }));
    build.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
      resources: [this.formatArn({ service: 'cloudfront', region: '', resource: 'distribution',
        resourceName: props.distribution.distributionId, arnFormat: ArnFormat.SLASH_RESOURCE_NAME })],
    }));
    const source = new codepipeline.Artifact();
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      artifactBucket: artifacts, crossAccountKeys: false,
      usePipelineRoleForActions: true,
      pipelineType: codepipeline.PipelineType.V2, executionMode: codepipeline.ExecutionMode.QUEUED,
      stages: [
        { stageName: 'Source', actions: [new actions.CodeStarConnectionsSourceAction({
          actionName: 'GitHub', owner: 'kuosmark', repo: 'airline-ranking', branch: 'main',
          connectionArn: connection.valueAsString, output: source,
        })] },
        { stageName: 'Deploy', actions: [new actions.CodeBuildAction({ actionName: 'CheckAndDeploy', project: build, input: source })] },
      ],
    });
    // Restrict the connection to this repository and branch, even if the GitHub installation expands.
    for (const prefix of ['codeconnections', 'codestar-connections']) {
      pipeline.role.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: [`${prefix}:UseConnection`], resources: [connection.valueAsString],
        conditions: { StringEquals: { [`${prefix}:FullRepositoryId`]: 'kuosmark/airline-ranking' } },
      }));
      for (const [key, value] of [['FullRepositoryId', 'kuosmark/airline-ranking'], ['BranchName', 'main']]) {
        pipeline.role.addToPrincipalPolicy(new iam.PolicyStatement({
          effect: iam.Effect.DENY, actions: [`${prefix}:UseConnection`], resources: [connection.valueAsString],
          conditions: { StringNotEquals: { [`${prefix}:${key}`]: value }, Null: { [`${prefix}:${key}`]: 'false' } },
        }));
      }
    }
  }
}
