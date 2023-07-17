#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NotificationApiStack } from '../lib/stack/NotificationApi';
import { Environment } from 'aws-cdk-lib';

const app = new cdk.App();
const env: Environment = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};
const envName = 'dev';

new NotificationApiStack(app, envName.toUpperCase() + 'NotificationApiStack', {
  envName,
  ecrRepositoryName: 'firebase-authorizer',
  authFunctionTagOrDigest: 'latest',
  lambdaEnvironment: {
    LOGGING_LEVEL: 'DEBUG',
  },
  platformApplicationArn: `arn:aws:sns:${env.region}:${env.account}:app/GCM/bus-notification`,
});
