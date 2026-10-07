import { CfnOutput, CfnParameter, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as dnsTargets from 'aws-cdk-lib/aws-route53-targets';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as targets from 'aws-cdk-lib/aws-scheduler-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { fileURLToPath } from 'node:url';

export class AirlineRankingStack extends Stack {
  readonly website: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly refresh: nodejs.NodejsFunction;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    if (props.env?.region !== 'eu-north-1') { throw new Error('Deploy only in eu-north-1'); }
    const polling: unknown = this.node.tryGetContext('isPollingEnabled');
    if (polling !== undefined && polling !== 'true' && polling !== 'false') {
      throw new Error('isPollingEnabled must be true or false');
    }
    const isPollingEnabled = polling === 'true';
    const alertEmail = new CfnParameter(this, 'AlertEmail', {
      type: 'String', description: 'Email for refresh failure alerts; requires SNS confirmation.',
      allowedPattern: '[^\\s@]+@[^\\s@]+\\.[^\\s@]+',
    });
    const certificateArn = new CfnParameter(this, 'CertificateArn', {
      type: 'String', description: 'Issued, non-exportable ACM certificate for airlines.markuskuosmanen.com in us-east-1.',
      allowedPattern: 'arn:aws:acm:us-east-1:[0-9]{12}:certificate/[a-f0-9-]+',
    });
    const hostedZoneId = new CfnParameter(this, 'HostedZoneId', {
      type: 'String', description: 'Existing public Route 53 zone for markuskuosmanen.com.',
      allowedPattern: 'Z[A-Z0-9]+',
    });
    const domainName = 'airlines.markuskuosmanen.com';
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn.valueAsString);
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'DomainZone', {
      hostedZoneId: hostedZoneId.valueAsString, zoneName: 'markuskuosmanen.com',
    });
    const website = new s3.Bucket(this, 'Website', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED, removalPolicy: RemovalPolicy.RETAIN,
    });
    const state = new s3.Bucket(this, 'State', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED, versioned: true, removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(7) }],
    });
    const origin = origins.S3BucketOrigin.withOriginAccessControl(website);
    const cachePolicy = new cloudfront.CachePolicy(this, 'CachePolicy', {
      minTtl: Duration.seconds(0), defaultTtl: Duration.seconds(30), maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true, enableAcceptEncodingBrotli: true,
    });
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [domainName], certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultRootObject: 'index.html', priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin, cachePolicy, viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD, compress: true,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      errorResponses: [403, 404].map(httpStatus => ({ httpStatus, ttl: Duration.seconds(0) })),
    });
    new route53.ARecord(this, 'WebsiteAlias', {
      zone, recordName: domainName,
      target: route53.RecordTarget.fromAlias(new dnsTargets.CloudFrontTarget(distribution)),
    });
    this.website = website;
    this.distribution = distribution;
    const logGroup = new logs.LogGroup(this, 'RefreshLogs', {
      retention: logs.RetentionDays.ONE_WEEK, removalPolicy: RemovalPolicy.DESTROY,
    });
    const refresh = new nodejs.NodejsFunction(this, 'Refresh', {
      entry: fileURLToPath(new URL('../backend/lambda.ts', import.meta.url)), handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X, architecture: lambda.Architecture.ARM_64,
      memorySize: 256, timeout: Duration.minutes(2), reservedConcurrentExecutions: 1, logGroup,
      retryAttempts: 0, maxEventAge: Duration.minutes(1),
      bundling: { externalModules: [], target: 'node22', minify: false },
      environment: { STATE_BUCKET: state.bucketName, WEBSITE_BUCKET: website.bucketName,
        SKYLINK_KEY_PARAMETER: '/airline-ranking/skylink-api-key' },
    });
    this.refresh = refresh;
    // Only these objects may be read/written; the poller cannot delete cache history or website files.
    refresh.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: ['operator-names.json', 'refresh-state.json'].map(key => state.arnForObjects(key)),
    }));
    refresh.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [website.arnForObjects('api/ranking')] }));
    const apiKey = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'ApiKey', {
      parameterName: '/airline-ranking/skylink-api-key',
    });
    refresh.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'], resources: [apiKey.parameterArn],
    }));
    const schedule = new scheduler.Schedule(this, 'RefreshSchedule', {
      schedule: scheduler.ScheduleExpression.rate(Duration.minutes(15)), enabled: isPollingEnabled,
      target: new targets.LambdaInvoke(refresh, {
        retryAttempts: 0, maxEventAge: Duration.minutes(1),
        input: scheduler.ScheduleTargetInput.fromObject({ scheduledAt: scheduler.ContextAttribute.scheduledTime }),
      }),
    });
    const alerts = new sns.Topic(this, 'Alerts');
    alerts.addSubscription(new subscriptions.EmailSubscription(alertEmail.valueAsString));
    const failures = new cloudwatch.Alarm(this, 'RefreshFailures', {
      metric: refresh.metricErrors({ period: Duration.minutes(15) }), threshold: 1, evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    failures.addAlarmAction(new actions.SnsAction(alerts));
    new CfnOutput(this, 'WebsiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'CustomDomainUrl', { value: `https://${domainName}` });
    new CfnOutput(this, 'WebsiteBucket', { value: website.bucketName });
    new CfnOutput(this, 'StateBucket', { value: state.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'RefreshFunction', { value: refresh.functionName });
    new CfnOutput(this, 'ScheduleName', { value: schedule.scheduleName });
  }
}
