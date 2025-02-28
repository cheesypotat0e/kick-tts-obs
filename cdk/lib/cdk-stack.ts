import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

const apiCloudFunctionUrl = process.env.API_CLOUD_FUNCTION_URL ?? "";
const authCloudFunctionUrl = process.env.AUTH_CLOUD_FUNCTION_URL ?? "";
const oauthCloudFunctionUrl = process.env.OAUTH_CLOUD_FUNCTION_URL ?? "";
const ttsCloudFunctionUrl = process.env.TTS_CLOUD_FUNCTION_URL ?? "";
export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tts = new cdk.aws_apigateway.RestApi(this, "CheesyBotTtsApi", {
      restApiName: "CheesyBot TTS API",
      description: "API Gateway for CheesyBot TTS",
      deployOptions: {
        stageName: "prod",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: cdk.aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
        allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
      },
    });

    tts.root.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(ttsCloudFunctionUrl, {
        httpMethod: "ANY",
        proxy: true,
      })
    );

    const api = new cdk.aws_apigateway.RestApi(this, "CheesyBotRestApi", {
      restApiName: "CheesyBot API",
      description: "API Gateway for CheesyBot",
      deployOptions: {
        stageName: "prod",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: cdk.aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
        allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
      },
    });

    const rootResource = api.root;
    rootResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(apiCloudFunctionUrl, {
        httpMethod: "ANY",
        proxy: true,
      })
    );

    rootResource.addResource("auth").addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(authCloudFunctionUrl, {
        httpMethod: "ANY",
        proxy: true,
      })
    );

    rootResource.addResource("oauth").addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(oauthCloudFunctionUrl, {
        httpMethod: "ANY",
        proxy: true,
      })
    );

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "URL of the API Gateway",
    });
  }
}
