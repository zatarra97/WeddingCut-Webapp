import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { 
    appDomain,
    cognitoBackofficeRoleAttributeName,
    mergeTags,
    projectAppName,
    projectName,
    userPoolEndpoint,
    userPoolId,
    reportingBucketReadPolicyArn,
} from "./config";

// Backoffice config
const poolClient = new aws.cognito.UserPoolClient(`${projectAppName}-userPoolClient`, {
    name: `${projectAppName}`,
    userPoolId: userPoolId,
    generateSecret: false,
    callbackUrls: [pulumi.interpolate`https://${appDomain}/callback`],
    logoutUrls: [pulumi.interpolate`https://${appDomain}/logout`],
    readAttributes: [
        "email",
        "email_verified",
        pulumi.interpolate`custom:${cognitoBackofficeRoleAttributeName}`,
    ],
    allowedOauthFlowsUserPoolClient: true,
    allowedOauthFlows: ["code"],
    allowedOauthScopes: [
        "email",
        "openid", 
        "profile", // to be verified if it's necessary
        "aws.cognito.signin.user.admin" // necessary to include groups in the id token
    ],
    idTokenValidity: 720, // 12 hours in minutes
    accessTokenValidity: 720, // 12 hours in minutes
    refreshTokenValidity: 720, // 12 hours in minutes
    tokenValidityUnits: {
        idToken: "minutes",
        accessToken: "minutes",
        refreshToken: "minutes",
    },
});

const userGroup = new aws.cognito.UserGroup(`${projectAppName}-userGroup-admin`, {
    userPoolId: userPoolId,
    name: pulumi.interpolate`${projectAppName}-admin`,
    description: pulumi.interpolate`Backoffice user group for ${projectName}`,
    precedence: 1,
});

// Create a Cognito Identity Pool
const identityPool = new aws.cognito.IdentityPool(`${projectAppName}-identity-pool`, {
    identityPoolName: pulumi.interpolate`${projectAppName} Identity Pool`,
    allowUnauthenticatedIdentities: false,
    cognitoIdentityProviders: [{
        clientId: poolClient.id,
        providerName: userPoolEndpoint,
        serverSideTokenCheck: false,
    }],
    tags: mergeTags({
        ResourceType: "CognitoIdentityPool",
        Component: "cognito",
        Service: "authentication",
        Purpose: "identity-federation",
    }),
});

// Create an IAM role for Cognito authentication
const cognitoRole = identityPool.id.apply(identityPoolId => new aws.iam.Role(`${projectAppName}-cognito-role`, {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {
                Federated: "cognito-identity.amazonaws.com"
            },
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": identityPoolId
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated"
                }
            }
        }]
    }),
    tags: mergeTags({
        ResourceType: "IAMRole",
        Component: "cognito",
        Service: "authentication",
        RoleType: "identity-pool",
        Purpose: "cognito-identity-pool-access",
    }),
}));

// Set up IAM roles for the Identity Pool
const identityPolicyAttachment = new aws.cognito.IdentityPoolRoleAttachment(`${projectAppName}-identity-pool-ra`, {
    identityPoolId: identityPool.id,
    roles: { authenticated: cognitoRole.arn},
});

new aws.iam.RolePolicyAttachment(`${projectAppName}-reporting-bucket-policy-attachment`, {
    role: cognitoRole.name,
    policyArn: reportingBucketReadPolicyArn,
}, { dependsOn: [cognitoRole] });

export const userPoolClientId = poolClient.id;
export const userGroupName = userGroup.name;
export const identityPoolId = identityPool.id;