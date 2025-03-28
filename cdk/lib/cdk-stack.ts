import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

const stripTrailingSlash = (url: string) => url.replace(/\/$/, "");

const apiCloudFunctionUrl = stripTrailingSlash(
  process.env.API_CLOUD_FUNCTION_URL ?? ""
);
const authCloudFunctionUrl = stripTrailingSlash(
  process.env.AUTH_CLOUD_FUNCTION_URL ?? ""
);
const oauthCloudFunctionUrl = stripTrailingSlash(
  process.env.OAUTH_CLOUD_FUNCTION_URL ?? ""
);
const ttsCloudFunctionUrl = stripTrailingSlash(
  process.env.TTS_CLOUD_FUNCTION_URL ?? ""
);
const kickApiCloudFunctionUrl = stripTrailingSlash(
  process.env.KICK_API_CLOUD_FUNCTION_URL ?? ""
);

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // TTS API Gateway (kept separate as requested)
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

    // Main API Gateway
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

    // Main API proxy integration
    const apiResource = rootResource.addResource("api");
    const apiProxyResource = apiResource.addResource("{proxy+}");
    apiProxyResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(`${apiCloudFunctionUrl}/{proxy}`, {
        httpMethod: "ANY",
        options: {
          requestParameters: {
            "integration.request.path.proxy": "method.request.path.proxy",
          },
        },
      }),
      {
        requestParameters: {
          "method.request.path.proxy": true,
        },
      }
    );

    // Auth integration
    const authResource = rootResource.addResource("auth");
    const authProxyResource = authResource.addResource("{proxy+}");
    authProxyResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(
        `${authCloudFunctionUrl}/{proxy}`,
        {
          httpMethod: "ANY",
          options: {
            requestParameters: {
              "integration.request.path.proxy": "method.request.path.proxy",
            },
          },
        }
      ),
      {
        requestParameters: {
          "method.request.path.proxy": true,
        },
      }
    );

    // OAuth integration
    const oauthResource = rootResource.addResource("oauth");
    const oauthProxyResource = oauthResource.addResource("{proxy+}");
    oauthProxyResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(
        `${oauthCloudFunctionUrl}/{proxy}`,
        {
          httpMethod: "ANY",
          options: {
            requestParameters: {
              "integration.request.path.proxy": "method.request.path.proxy",
            },
          },
        }
      ),
      {
        requestParameters: {
          "method.request.path.proxy": true,
        },
      }
    );

    const kickApiResource = rootResource.addResource("kick");
    const kickApiProxyResource = kickApiResource.addResource("{proxy+}");
    kickApiProxyResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(
        `${kickApiCloudFunctionUrl}/{proxy}`,
        {
          httpMethod: "ANY",
          options: {
            requestParameters: {
              "integration.request.path.proxy": "method.request.path.proxy",
            },
          },
        }
      ),
      {
        requestParameters: {
          "method.request.path.proxy": true,
        },
      }
    );

    // Add root path methods without proxy parameters
    authResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(authCloudFunctionUrl, {
        httpMethod: "ANY",
      })
    );

    apiResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(apiCloudFunctionUrl, {
        httpMethod: "ANY",
      })
    );

    oauthResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(oauthCloudFunctionUrl, {
        httpMethod: "ANY",
      })
    );

    kickApiResource.addMethod(
      "ANY",
      new cdk.aws_apigateway.HttpIntegration(kickApiCloudFunctionUrl, {
        httpMethod: "ANY",
      })
    );

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "URL of the API Gateway",
    });

    new cdk.CfnOutput(this, "TtsApiUrl", {
      value: tts.url,
      description: "URL of the TTS API Gateway",
    });
  }
}
