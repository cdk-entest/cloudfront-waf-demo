---
title: CloudFront and WAF
author: haimtran
description: deploy static web using cloudfront and waf
publishedDate: 25/10/2022
date: 25/10/2022
---

## Introduction

[GitHub](https://github.com/cdk-entest/cloudfront-waf-demo)

- Deploy two static web with CloudFront and S3
- Add WAF to protect the web
- Walk through parameters and dicussion

## Deploy Static Web

![aws_devops-ica drawio(1)](https://user-images.githubusercontent.com/20411077/170626352-684c0b01-dc53-4e8e-bcf8-59194833f303.png)

What uses cases?

- [Edges location](https://aws.amazon.com/cloudfront/features/?whats-new-cloudfront.sort-by=item.additionalFields.postDateTime&whats-new-cloudfront.sort-order=desc) cache content to coler users
- Protect the site with WAF
- [Header security](https://aws.amazon.com/blogs/networking-and-content-delivery/adding-http-security-headers-using-lambdaedge-and-amazon-cloudfront/) - XSS attacks

What is the best practice?

- [Pricing](https://aws.amazon.com/cloudfront/pricing/)
- [Cache expire time](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html)
- [Deployment time](https://aws.amazon.com/premiumsupport/knowledge-center/cloudfront-serving-outdated-content-s3/)
- S3 policy to grant access to CloudFront OAI
- Monitor, log, optimization

What termilogy? - [Origin](https://aws.amazon.com/blogs/networking-and-content-delivery/amazon-cloudfront-introduces-response-headers-policies/) - [HTTP header ](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/getting-started-secure-static-website-cloudformation-template.html) - [Distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)

## CDK Stack

1. Create s3 bucket to store static content

```tsx
const bucket = new aws_s3.Bucket(this, "BucketHostStaticWeb", {
  bucketName: "bucket-static-web",
  // not production recommended
  removalPolicy: RemovalPolicy.DESTROY,
  // not production recommended
  autoDeleteObjects: true,
  // block public read
  publicReadAccess: false,
  // block public access - production recommended
  blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
});
```

2. Create CloudFront OAI (identity)

```tsx
const cloudfrontOAI = new aws_cloudfront.OriginAccessIdentity(
  this,
  "CloudFrontOAIIcaDemo",
  {
    comment: "OAI for ICA demo",
  }
);
```

3. Bucket grant access to (only) CloudFront OAI

```tsx
bucket.addToResourcePolicy(
  new aws_iam.PolicyStatement({
    actions: ["s3:GetObject"],
    resources: [bucket.arnForObjects("*")],
    principals: [
      new aws_iam.CanonicalUserPrincipal(
        cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
      ),
    ],
  })
);
```

4. Create a CloudFront distribution - S3 origin - OAI permissions

```tsx
const distribution = new aws_cloudfront.Distribution(this, "Distribution", {
  defaultBehavior: {
    origin: new aws_cloudfront_origins.S3Origin(bucket, {
      originAccessIdentity: cloudfrontOAI,
    }),
  },
  // https://cloudfront-domain.net works
  // no need https://cloudfront-domain.net/index.html
  defaultRootObject: "index.html",
});
```

5. Deploy the web (upload static content)

```tsx
new aws_s3_deployment.BucketDeployment(this, "DeployWebsite", {
  sources: [aws_s3_deployment.Source.asset("./lib/website-dist")],
  destinationBucket: bucket,
  distribution: distribution,
});
```

# Part II. AWS WAF CloudFront Protection

What use cases?

- Protect a web by Geo restriction
- Protect a web from anomaly IP requests
- Protect a web from bad IPs
- [Cross-site scripting, SQL injection, ...](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rules.html)

WAF Rules

- [AWS managed rules - baseline](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-baseline.html)
- [User defined rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rules.html)

## Architecture

![aws_devops-ica drawio (2)](https://user-images.githubusercontent.com/20411077/169648439-8c6a0bb1-f71c-4e65-93d3-afc923172ebf.png)

## CDK Stack

1. Create WAF ACL

```tsx
const webAcl = new aws_wafv2.CfnWebACL(this, "WafCloudFrontProtectIcaDemo", {
  defaultAction: { allow: {} },
  scope: "CLOUDFRONT",
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: "waf-cloudfront",
    sampledRequestsEnabled: true,
  },
  description: "WAFv2 ACL for CloudFront",
  name: "WafCloudFrontProtectIcaDemo",
  rules: [
    awsMangedRuleIPReputationList,
    ruleLimiteRequests100,
    ruleGeoRestrict,
  ],
});
```

2. AWSManagedRulesCommonRuleSet block bad IPs

```tsx
const awsMangedRuleIPReputationList: aws_wafv2.CfnWebACL.RuleProperty = {
  name: "AWSManagedRulesCommonRuleSet",
  priority: 10,
  statement: {
    managedRuleGroupStatement: {
      name: "AWSManagedRulesCommonRuleSet",
      vendorName: "AWS",
    },
  },
  overrideAction: { none: {} },
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: "AWSIPReputationList",
  },
};
```

3. Geo restriction

```tsx
const ruleGeoRestrict: aws_wafv2.CfnWebACL.RuleProperty = {
  name: "RuleGeoRestrict",
  priority: 2,
  action: {
    block: {},
  },
  statement: {
    geoMatchStatement: {
      countryCodes: ["US"],
    },
  },
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: "GeoMatch",
  },
};
```

4. Block anomaly request by a threshold

```tsx
const ruleLimiteRequests100: aws_wafv2.CfnWebACL.RuleProperty = {
  name: "LimiteRequests100",
  priority: 1,
  action: {
    block: {},
  },
  statement: {
    rateBasedStatement: {
      limit: 100,
      aggregateKeyType: "IP",
    },
  },
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: "LimitRequests100",
  },
};
```

5. Attach the web by sending concurrent requests

```python
from calendar import c
import time
from pymysql import NUMBER
import requests
from concurrent.futures import ThreadPoolExecutor

NUM_CONCURRENT_REQUEST = 200
URL_CDK_AMPLIFY = "https://d1ooatqwf6thb8.cloudfront.net/"
URL_WELCOME_HAI = "https://d2mb7sioza8ovy.cloudfront.net/"


def send_one_request(id: int, url=URL_CDK_AMPLIFY):
    """
    """
    print("send request {0} to {1}".format(id, url))
    requests.get(url=url)


def send_concurrent_request(num_concur_request=100):
    """
    """
    with ThreadPoolExecutor(max_workers=num_concur_request) as executor:
        for k in range(1, num_concur_request):
            executor.submit(send_one_request, k)


if __name__ == "__main__":
    bucket_count = 1
    while True:
        print("send bucket {0} with {1}".format(
            bucket_count, NUM_CONCURRENT_REQUEST))
        send_concurrent_request(NUM_CONCURRENT_REQUEST)
        bucket_count += 1
        time.sleep(5)
```

## Part 3. Header security with Lambda@Edge

[reference here](https://aws.amazon.com/blogs/networking-and-content-delivery/adding-http-security-headers-using-lambdaedge-and-amazon-cloudfront/)

![header](https://user-images.githubusercontent.com/20411077/170638794-c2558960-de65-4e4c-b5e9-2a068c8f584e.png)

## Reference

- [CDK WAF](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_wafv2.CfnWebACL.html)
- [AWS WAF Dev Doc](https://docs.aws.amazon.com/waf/latest/developerguide/waf-chapter.html)
- [CDK WAF Sample Code](https://github.com/aws-samples/aws-cdk-examples/blob/master/typescript/waf/waf-cloudfront.ts)

## CloudFront Trobleshooting

- CloudFront x Origin connection error
- HTTP 403 Forbidden
  - Server understood the request but it refused authorization
  - From S3 - Access Denied and S3 request ID
  - From CloudFront - generated by CloudFront
  - Geo-restriction
- Route 53 and a domain from another account
- Request an ACM certificate to prove you own the domain
- Configure the CloudFront distribution with the ACM cert and custom domain
- Go to the other account (Route 53) and create a record CNAME

## CDK deploy first

deploy welcome hai web

```bash
cdk deploy WelcomeHaiCloudFrontStack
```

deploy cdk-amplify web

```bash
cdk deploy CdkAmplifyCloudFrontStack
```

deploy waf rules

```bash
cdk deploy WafRulesDemo
```

## Verify

- check hit cloudfront cache
- check geo restricted SG

```bash
curl https://d32kbvvu3drs8u.cloudfront.net/
```

- check rate-based IP block

```bash
test/test_waf_rate_base_rule.py
```
