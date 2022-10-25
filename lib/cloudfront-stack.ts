import {
  aws_cloudfront,
  aws_cloudfront_origins,
  aws_iam,
  aws_s3,
  aws_s3_deployment,
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface CloudfrontStackProps extends StackProps {
  bucketName: string;
  distPath: string;
}

export class CloudfrontStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: CloudfrontStackProps
  ) {
    super(scope, id, props);

    // 1. Create s3 bucket to store static content
    const bucket = new aws_s3.Bucket(
      this,
      "BucketHostStaticWeb",
      {
        bucketName: props.bucketName,
        // not production recommended
        removalPolicy: RemovalPolicy.DESTROY,
        // not production recommended
        autoDeleteObjects: true,
        // block public read
        publicReadAccess: false,
        // block public access - production recommended
        blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      }
    );

    // 2. Create CloudFront OAI (identity)
    const cloudfrontOAI =
      new aws_cloudfront.OriginAccessIdentity(
        this,
        "CloudFrontOAIIcaDemo",
        {
          comment: "OAI for ICA demo",
        }
      );

    // 3. Bucket grant access to (only) CloudFront OAI
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

    // 4. CloudFront distribution - S3 origin - OAI
    const distribution = new aws_cloudfront.Distribution(
      this,
      "Distribution",
      {
        defaultBehavior: {
          origin: new aws_cloudfront_origins.S3Origin(bucket, {
            originAccessIdentity: cloudfrontOAI,
          }),
        },
        // https://cloudfront-domain.net works
        // no need https://cloudfront-domain.net/index.html
        defaultRootObject: "index.html",
      }
    );

    // 5. Deploy the web (upload static content to S3)
    new aws_s3_deployment.BucketDeployment(
      this,
      "DeployWebsite",
      {
        sources: [
          aws_s3_deployment.Source.asset(props.distPath),
        ],
        destinationBucket: bucket,
        distribution: distribution,
      }
    );

    // output 
    new CfnOutput(
      this,
      'distributionDomainName',
      {
        value: distribution.distributionId
      }
    )
  }
}
