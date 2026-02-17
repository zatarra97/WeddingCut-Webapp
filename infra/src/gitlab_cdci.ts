import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as gitlab from "@pulumi/gitlab";
import {
    glabProvider,
} from "./gitlab";
import {
    gitlabUserAccessKeyId,
    gitlabUserSecretAccessKey,
} from "./iam";
import {
    appDescription,
    backendApiUrl,
    environment,
    glabProjectId,
    googleApiKey,
    projectAppName,
    reactAppName,
    rollbarToken,
    userPoolId,
    reportingBucketArn,
    reportingBucketName,
} from "./config";
import {    
    userPoolClientId,
    identityPoolId,
} from "./cognito";
import {
    bucketName as cloudfrontBucketName,
    distributionId
} from "./cloudfront";

new gitlab.ProjectEnvironment(`${projectAppName}-glab-env-${environment}`, {
    project: pulumi.output(glabProjectId).apply(id => id.toString()),
    name: environment,
}, { provider: glabProvider });

const buildPath = "build";

// Define an array of configEntrys for different environments
const environmentConfigMap = [
    { key: "AWS_ACCESS_KEY_ID", value: gitlabUserAccessKeyId, protected: true, masked: false },
    { key: "AWS_SECRET_ACCESS_KEY", value: gitlabUserSecretAccessKey, protected: true, masked: true },
    { key: "CLOUD_FRONT_DISTRIBUTION_ID", value: distributionId, protected: false, masked: false },
    { key: "CLOUD_FRONT_S3_BUCKET", value: cloudfrontBucketName, protected: false, masked: false },
    { key: "VITE_AWS_REGION", value: `${aws.config.region}`, protected: false, masked: false },
    { key: "VITE_BACKEND_URL", value: backendApiUrl, protected: true, masked: false },
    { key: "VITE_COGNITO_CLIENT_ID", value: userPoolClientId, protected: false, masked: false },
    { key: "VITE_COGNITO_USER_POOL_ID", value: userPoolId, protected: false, masked: false },
    { key: "VITE_COGNITO_IDENTITY_POOL_ID", value: identityPoolId, protected: false, masked: false },
    { key: "VITE_ENVIRONMENT", value: environment, protected: false, masked: false },
    { key: "VITE_REPORTING_BUCKET_ARN", value: reportingBucketArn, protected: false, masked: false },
    { key: "VITE_REPORTING_BUCKET_NAME", value: reportingBucketName, protected: false, masked: false },
];

// Iterate over the array and create the configEntrys in GitLab
environmentConfigMap.forEach(configEntry => {
    let projectVariable = new gitlab.ProjectVariable(`${projectAppName}-glab-${configEntry.key}`, {
        project: glabProjectId,
        key: configEntry.key,
        value: configEntry.value,
        environmentScope: environment, // Environment scope,
        protected: configEntry.protected,
    }, { provider: glabProvider });
});

// Define an array of configEntrys for different environments
const globalConfigMap = [
    { key: "AWS_DEFAULT_REGION", value: `${aws.config.region}`, protected: false, masked: false },
    { key: "BUILD_PATH", value: buildPath, protected: false, masked: false },
    { key: "VITE_DESC", value: appDescription, protected: false, masked: false },
    { key: "VITE_APP_NAME", value: reactAppName, protected: false, masked: false },
    { key: "VITE_GOOGLE_API_KEY", value: googleApiKey, protected: true, masked: true },
    { key: "VITE_ROLLBAR_TOKEN", value: rollbarToken, protected: true, masked: true },
];

// Iterate over the array and create the configEntrys in GitLab
globalConfigMap.forEach(configEntry => {
    let projectVariable = new gitlab.ProjectVariable(`${projectAppName}-glab-${configEntry.key}`, {
        project: glabProjectId,
        key: configEntry.key,
        value: configEntry.value,
        environmentScope: "*", // Global scope,
        protected: configEntry.protected,
    }, { provider: glabProvider });
});