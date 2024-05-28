#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EcsStack } from "../lib/ecs-stack";

const app = new cdk.App();

new EcsStack(app, "EcsStack6", {
  env: { account: "974343573363", region: "us-east-1" },
});
