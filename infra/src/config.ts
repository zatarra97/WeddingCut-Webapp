import * as pulumi from "@pulumi/pulumi";

// Create a Pulumi configuration object
const config = new pulumi.Config();
export const environment = config.require("environment");
export const envTag = config.require("envTag");

// Project configuration
export const projectAppName = config.require("projectAppName");
export const reactAppName = config.require("reactAppName");
export const appName = config.require("appName");
export const appSubDomain = config.require("appSubDomain");
export const appDescription = config.require("appDescription");
export const googleApiKey = config.requireSecret("googleApiKey");
export const rollbarToken = config.requireSecret("rollbarToken");

// Variables imported from the main group stack, re-exported locally
const infraStack = config.require("infraStack");
const infraStackRef = new pulumi.StackReference(`${infraStack}/${environment}`);
const reportingStack = config.require("reportingStack");
const reportingStackRef = new pulumi.StackReference(`${reportingStack}/${environment}`);

export const bucketArn = infraStackRef.requireOutput("mainBucketArn").apply(name => name as string);
export const bucketName = infraStackRef.requireOutput("mainBucketName").apply(name => name as string);
export const curveS3BucketArn = infraStackRef.requireOutput("curveS3BucketArn").apply(name => name as string);
export const curveS3BucketName = infraStackRef.requireOutput("curveS3BucketName").apply(name => name as string);
export const curveS3BucketReadPolicyArn = infraStackRef.requireOutput("curveS3BucketReadPolicyArn").apply(name => name as string);
export const cognitoBackofficeRoleAttributeName = infraStackRef.requireOutput("cognitoBackofficeRoleAttributeName").apply(name => name as string);
export const dnsDomain = infraStackRef.requireOutput("dnsDomain").apply(name => name as string);
export const mainZoneId = infraStackRef.requireOutput("mainZoneId").apply(name => name as string);
export const projectName = infraStackRef.requireOutput("projectName").apply(name => name as string);
export const sslCertificateUSE1Arn = infraStackRef.requireOutput("sslCertificateUSE1Arn").apply(name => name as string);
export const userPoolEndpoint = infraStackRef.requireOutput("userPoolEndpoint").apply(name => name as string);
export const userPoolId = infraStackRef.requireOutput("userPoolId").apply(name => name as string);
export const reportingBucketArn = reportingStackRef.requireOutput("bucketArn").apply(name => name as string);
export const reportingBucketName = reportingStackRef.requireOutput("bucketName").apply(name => name as string);
export const reportingBucketReadPolicyArn = reportingStackRef.requireOutput("bucketReadPolicyArn").apply(name => name as string);

// Dns configuration
export const mainDnsDomain = infraStackRef.requireOutput("dnsDomain").apply(name => name as string);
export const apiSubDomain = infraStackRef.requireOutput("boApiNameSubdomain").apply(name => name as string);
// Construct the full domain dynamically
export const apiDomain = pulumi.interpolate`${apiSubDomain}.${mainDnsDomain}`;
export const backendApiUrl = pulumi.interpolate`https://${apiDomain}`;
export const appDomain = pulumi.interpolate`${appSubDomain}.${dnsDomain}`;
export const appUrl = pulumi.interpolate`https://${appDomain}`;

// Gitlab config
export const glabToken = config.requireSecret("glabToken");
export const glabProjectId = config.require("glabProjectId");
export const glabGroupName = infraStackRef.requireOutput("glabGroupName").apply(name => name as string);
// export const glabGroupDisplayName = infraStackRef.requireOutput("glabGroupDisplayName").apply(name => name as string);
// export const glabGroupId = infraStackRef.requireOutput("glabGroupId").apply(id => parseInt(id as string, 10));

const externalSecurityStack = config.require("externalSecurityStack");
const externalSecurityStackRef = new pulumi.StackReference(`${externalSecurityStack}/${environment}`);
export const webAclArn = externalSecurityStackRef.requireOutput("globalWebAclArn").apply(name => name as string);

// Common tags as defined in TAGGING-STRATEGY.md
export const commonTags = {
    Environment: environment,
    Project: projectName,
    Stack: `${pulumi.getProject()}/${pulumi.getStack()}`,
    ManagedBy: "Pulumi",
    Application: appName,
    Owner: "OrangeMeter",
};

// Helper function to merge common tags with resource-specific tags
export const mergeTags = (resourceTags: Record<string, string> = {}) => ({
    ...commonTags,
    ...resourceTags,
});
