#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CloudfrontStack } from "../lib/cloudfront-stack";
import { IcaWafDemoStack } from "../lib/waf-stack";

const app = new cdk.App();

// welcome hai cloudfront web
const haiWeb = new CloudfrontStack(app, "WelcomeHaiCloudFrontStack", {
  bucketName: "welcome-hai-cloudfront-bucket",
  distPath: "./lib/welcome-hai-dist",
  env: {
    region: "us-east-1",
  },
});

// cdk-amplify cloudfront web
const cdkWeb = new CloudfrontStack(app, "CdkAmplifyCloudFrontStack", {
  bucketName: "cdk-amplify-cloudfront-bucket",
  distPath: "./lib/cdk-amplify-dist",
  env: {
    region: "us-east-1",
  },
});

// waf rules stack CloudFront WAF to be us-east-1
const waf = new IcaWafDemoStack(app, "WafRulesDemo", {
  env: {
    region: "us-east-1",
  },
});

waf.addDependency(cdkWeb);
