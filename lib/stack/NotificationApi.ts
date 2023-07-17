import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as openapix from '@alma-cdk/openapix';
import * as path from 'path';

import {
  aws_iam as iam,
  aws_lambda as lambda,
  aws_ecr as ecr,
  aws_apigateway as apigw,
} from 'aws-cdk-lib';

export interface ApiStackProps extends StackProps {
  readonly envName?: string;
  readonly apiName?: string;
  readonly platformApplicationArn: string;
  readonly ecrRepositoryName: string;
  readonly authFunctionTagOrDigest?: string;
  readonly lambdaEnvironment?: { [key: string]: string };
}

export class NotificationApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    const envName = props.envName ?? 'dev';
    super(scope, id, props);

    const lambdaAuthorizerRole = new iam.Role(this, envName + 'LambdaRole', {
      roleName: envName + 'LambdaRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        {
          managedPolicyArn:
            'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        },
      ],
    });

    const authFunctionInvokeRole = new iam.Role(
      this,
      envName + 'authFunctionInvokeRole',
      {
        roleName: envName + 'AuthFunctionInvokeRole',
        assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      }
    );

    const managePlatformEndpointRole = new iam.Role(
      this,
      envName + 'ManagePlatformEndpointRole',
      {
        roleName: envName + 'ManagePlatformEndpointRole',
        assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
        inlinePolicies: {
          managePlatformEndpoint: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['sns:CreatePlatformEndpoint'],
                resources: [props.platformApplicationArn],
              }),
              // new iam.PolicyStatement({
              //   effect: iam.Effect.ALLOW,
              //   actions: ['sns:DeletePlatformEndpoint'],
              //   resources: [props.platformApplicationArn],
              // }),
            ],
          }),
        },
      }
    );

    const firebaseAuthRepository = ecr.Repository.fromRepositoryName(
      this,
      envName + 'FirebaseAuthRepo',
      props.ecrRepositoryName
    );

    const lambdaAuthFunction = new lambda.DockerImageFunction(
      this,
      envName + 'FirebaseAuthFunction',
      {
        environment: props.lambdaEnvironment,
        code: lambda.DockerImageCode.fromEcr(firebaseAuthRepository, {
          tagOrDigest: props.authFunctionTagOrDigest ?? 'latest',
        }),
        role: lambdaAuthorizerRole,
      }
    );
    lambdaAuthFunction.grantInvoke(authFunctionInvokeRole);

    const notificationApi = new openapix.Api(
      this,
      envName + 'NotificationApi',
      {
        source: path.join(__dirname, '../static/openapi.yaml'),
        validators: {
          all: {
            validateRequestBody: true,
            validateRequestParameters: true,
            default: true,
          },
        },
        restApiProps: {
          restApiName: props.apiName ?? envName + 'NotificationApi',
          deploy: true,
        },
        authorizers: [
          {
            id: 'bearerAuth',
            xAmazonApigatewayAuthtype: 'custom',
            xAmazonApigatewayAuthorizer: {
              authorizerCredentials: authFunctionInvokeRole.roleArn,
              type: 'token',
              authorizerUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${lambdaAuthFunction.functionArn}/invocations`,
            },
          },
        ],
        paths: {
          '/device': {
            post: new openapix.AwsIntegration(this, {
              service: 'sns',
              action: 'CreatePlatformEndpoint',
              integrationHttpMethod: 'POST',
              options: {
                credentialsRole: managePlatformEndpointRole,
                passthroughBehavior:
                  apigw.PassthroughBehavior.WHEN_NO_TEMPLATES,
                requestParameters: {
                  'integration.request.querystring.Token':
                    'method.request.body.deviceToken',
                  'integration.request.querystring.PlatformApplicationArn': `'${props.platformApplicationArn}'`,
                },
                integrationResponses: [
                  {
                    statusCode: '200',
                    selectionPattern: '2\\d{2}',
                    responseTemplates: {
                      'application/json': [
                        '{',
                        ' "endpointId": "$util.escapeJavaScript($input.path(\'CreatePlatformEndpointResponse.CreatePlatformEndpointResult.EndpointArn\').split(\'/\')[3])"',
                        '}',
                      ].join('\n'),
                    },
                  },
                  {
                    statusCode: '400',
                    selectionPattern: '4\\d{2}',
                  },
                  {
                    statusCode: '500',
                    selectionPattern: '5\\d{2}',
                  },
                ],
              },
            }),
          },
        },
      }
    );
  }
}
