import { App } from 'aws-cdk-lib';
import { AirlineRankingStack } from './stack.ts';

const app = new App();
new AirlineRankingStack(app, 'AirlineRanking', {
  env: { account: process.env['CDK_DEFAULT_ACCOUNT'], region: 'eu-north-1' },
  terminationProtection: true,
});
