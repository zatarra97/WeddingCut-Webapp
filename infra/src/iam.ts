import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {
    mergeTags,
    projectName,
    projectAppName,
    appSubDomain,
} from "./config";
import {
    distributionArn,
    bucketArn,
} from "./cloudfront";

// Create an IAM user
const user = new aws.iam.User(`${projectAppName}-glab-user`, {
    name: `${projectAppName}-glab-user`,
    tags: mergeTags({
        ResourceType: "IAMUser",
        Component: "gitlab",
        Service: "cicd",
        UserType: "service",
        Purpose: "deployment-automation",
    }),
});

// Create IAM user access key
const accessKey = new aws.iam.AccessKey(`${projectAppName}-glab-accessKey`, {
    user: user.name,
});

// Store the access key ID in Parameter Store
const ssmParameter = new aws.ssm.Parameter(`${projectAppName}-glab-user-ssm-accessKey`, {
    type: "SecureString",
    name:  pulumi.interpolate`/${projectName}/${appSubDomain}/accesKeyId`,
    value: accessKey.id,
    tags: mergeTags({
        ResourceType: "SSMParameter",
        Component: "gitlab",
        Service: "cicd",
        ParameterType: "access-key-id",
        Purpose: "deployment-credentials",
    }),
});

// Store the secret access key in Parameter Store
const secretKeyParameter = new aws.ssm.Parameter(`${projectAppName}-glab-user-ssm-secretKey`, {
    type: "SecureString",
    name: pulumi.interpolate`/${projectName}/${appSubDomain}/secretKey`,
    value: accessKey.secret,
    tags: mergeTags({
        ResourceType: "SSMParameter",
        Component: "gitlab",
        Service: "cicd",
        ParameterType: "secret-access-key",
        Purpose: "deployment-credentials",
    }),
});

// Create IAM policy for S3 and CloudFront permissions
const policy = new aws.iam.UserPolicy(`${projectAppName}-glab-policy`, {
    user: user.name,
    policy: pulumi.all([bucketArn, bucketArn.apply(arn => `${arn}/*`), distributionArn]).apply(([bucketArn, bucketObjectsArn, distributionArn]) => JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Action: [
                    "s3:PutObject",
                    "s3:GetObject",
                    "s3:ListBucket",
                    "s3:DeleteObject",
                ],
                Resource: [
                    bucketArn,
                    bucketObjectsArn,
                ],
            },
            {
                Effect: "Allow",
                Action: [
                    "cloudfront:CreateInvalidation",
                ],
                Resource: [
                    distributionArn,
                ],
            },
        ],
    })),
});

export const gitlabUserAccessKeyId = accessKey.id;
export const gitlabUserSecretAccessKey = accessKey.secret;