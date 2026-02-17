import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {
    appDomain,
    mainZoneId,
    mergeTags,
    projectAppName,
    sslCertificateUSE1Arn,
    webAclArn,
} from "./config";

// Create an S3 bucket
const bucket = new aws.s3.Bucket(`${projectAppName}-cloudfront-s3-bucket`, {
    bucket: `${projectAppName}-cloudfront-s3-bucket`,
    acl: "private",
    tags: mergeTags({
        ResourceType: "S3Bucket",
        Component: "cloudfront",
        Service: "webapp-hosting",
        Purpose: "static-website",
    }),
});

// Create an Origin Access Control (OAC)
const originAccessControl = new aws.cloudfront.OriginAccessControl(`${projectAppName}-cloudfront-oac`, {
    name: `${projectAppName}-cloudfront-oac`,
    originAccessControlOriginType: "s3",
    signingBehavior: "always",
    signingProtocol: "sigv4",
});

// Create CloudFront distribution
const distribution = new aws.cloudfront.Distribution(`${projectAppName}-cloudfront`, {
    enabled: true,
    defaultRootObject: "index.html",
    aliases: [ appDomain ],
    origins: [{
        domainName: bucket.bucketRegionalDomainName,
        originId: bucket.id,
        originAccessControlId: originAccessControl.id, // This is normal and required
    }],
    webAclId: webAclArn,
    defaultCacheBehavior: {
        targetOriginId: bucket.id,
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD"],
        forwardedValues: {
            queryString: false,
            cookies: {
                forward: "none",
            },
        },
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
    },
    customErrorResponses: [
        {
            errorCode: 404,
            responsePagePath: "/index.html",
            responseCode: 200,
            errorCachingMinTtl: 300,
        },
        {
            errorCode: 403,
            responsePagePath: "/index.html",
            responseCode: 200,
            errorCachingMinTtl: 300,
        },
    ],
    viewerCertificate: {
        acmCertificateArn: sslCertificateUSE1Arn,
        sslSupportMethod: "sni-only",
        // cloudfrontDefaultCertificate: true,
    },
    restrictions: {
        geoRestriction: {
            restrictionType: "whitelist",
            locations: ["IT"], // For Italy only
        },
    },
    tags: mergeTags({
        ResourceType: "CloudFrontDistribution",
        Component: "cloudfront",
        Service: "webapp-hosting",
        Purpose: "content-delivery",
        GeographicRestriction: "IT",
    }),
});

// Create the S3 bucket policy to allow CloudFront access via the OAC
const bucketPolicy = new aws.s3.BucketPolicy(`${projectAppName}-bucket-policy`, {
    bucket: bucket.id,
    policy: pulumi.all([bucket.id, distribution.arn]).apply(([bucketName, distributionArn]) => JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: {
                    Service: "cloudfront.amazonaws.com",
                },
                Action: "s3:GetObject",
                Resource: `arn:aws:s3:::${bucketName}/*`,
                Condition: {
                    StringEquals: {
                        "AWS:SourceArn": distributionArn,
                    },
                },
            },
        ],
    })),
});

// Create Route53 record for the CloudFront distribution
const record = new aws.route53.Record(`${projectAppName}-dnsRecord`, {
    zoneId: mainZoneId,
    name: appDomain,
    type: "A",
    aliases: [{
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: true,
    }],
});

// Export necessary information
export const bucketName = bucket.id;
export const bucketArn = bucket.arn;
export const distributionId = distribution.id;
export const distributionDomain = distribution.domainName;
export const distributionArn = distribution.arn;
