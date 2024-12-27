import * as cdk from "aws-cdk-lib";
import { RestApi, LambdaIntegration, Cors } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import {
  Table,
  BillingMode,
  AttributeType,
  ProjectionType,
} from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Code } from "aws-cdk-lib/aws-lambda";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bitsTable = new Table(this, "BitsTable", {
      tableName: "bits",
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
    });

    bitsTable.addGlobalSecondaryIndex({
      indexName: "bits-by-name",
      partitionKey: {
        name: "name",
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.KEYS_ONLY,
    });

    const voiceTable = new Table(this, "VoicesTable", {
      tableName: "voices",
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: AttributeType.STRING },
    });

    voiceTable.addGlobalSecondaryIndex({
      indexName: "voices-by-name",
      partitionKey: {
        name: "voiceName",
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.KEYS_ONLY,
    });

    const settingsTable = new Table(this, "SettingsTable", {
      tableName: "settings",
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: AttributeType.STRING },
    });

    const settingsHandler = new NodejsFunction(this, "SettingsLamnda", {
      code: Code.fromCustomCommand("dist/lambda", [
        "pnpm",
        "ts-node-esm",
        "lambda.build.ts",
      ]),
      handler: "settings.handler",
      timeout: cdk.Duration.seconds(10),
      environment: {
        SETTINGS_TABLE_NAME: settingsTable.tableName,
        BITS_TABLE_NAME: bitsTable.tableName,
        VOICES_TABLE_NAME: voiceTable.tableName,
      },
    });

    const voicesHandler = new NodejsFunction(this, "VoicesLamnda", {
      code: Code.fromCustomCommand("dist/lambda", [
        "pnpm",
        "ts-node-esm",
        "lambda.build.ts",
      ]),
      handler: "voices.handler",
      environment: {
        VOICES_TABLE_NAME: voiceTable.tableName,
      },
    });

    const bitsHandler = new NodejsFunction(this, "BitsLamnda", {
      code: Code.fromCustomCommand("dist/lambda", [
        "pnpm",
        "ts-node-esm",
        "lambda.build.ts",
      ]),
      handler: "bits.handler",
      environment: {
        BITS_TABLE_NAME: bitsTable.tableName,
      },
    });

    settingsTable.grantReadWriteData(settingsHandler);
    voiceTable.grantReadData(settingsHandler);
    bitsTable.grantReadData(settingsHandler);
    voiceTable.grantReadWriteData(voicesHandler);
    bitsTable.grantReadWriteData(bitsHandler);

    const api = new RestApi(this, "RestApi");

    const settingsLambdaIntegration = new LambdaIntegration(settingsHandler);

    const voicesLambdaIntegration = new LambdaIntegration(voicesHandler);

    const bitsLambdaIntegration = new LambdaIntegration(bitsHandler);

    const settingsResource = api.root.addResource("settings", {
      defaultCorsPreflightOptions: { allowOrigins: Cors.ALL_ORIGINS },
    });

    settingsResource.addMethod("POST", settingsLambdaIntegration);

    settingsResource
      .addResource("{id}")
      .addMethod("GET", settingsLambdaIntegration, {});

    const voicesResources = api.root.addResource("voices", {
      defaultCorsPreflightOptions: { allowOrigins: Cors.ALL_ORIGINS },
    });

    voicesResources
      .addResource("{id}")
      .addMethod("GET", voicesLambdaIntegration);

    voicesResources.addMethod("POST", voicesLambdaIntegration);

    const bitsResources = api.root.addResource("bits", {
      defaultCorsPreflightOptions: { allowOrigins: Cors.ALL_ORIGINS },
    });

    bitsResources.addMethod("POST", bitsLambdaIntegration);
    bitsResources.addResource("{id}").addMethod("GET", bitsLambdaIntegration);
  }
}
