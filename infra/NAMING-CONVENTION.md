# Pulumi Infrastructure Naming Convention

This document defines the comprehensive naming convention for all AWS resources created through Pulumi infrastructure-as-code for the OrangeMeter IoT project. This convention ensures consistency, maintainability, and clear resource identification across all environments and components.

## Overview

The naming convention follows a hierarchical structure that combines project identification, component classification, and resource specificity to create predictable and meaningful resource names.

## Configuration Variables

All naming conventions are built upon the foundational configuration variables defined in `Pulumi.yaml`:

```yaml
# Core project identifiers
orangemeter-iot:projectName: orangemeter           # Base project name
orangemeter-iot:appName: iot                       # Application/service identifier  
orangemeter-iot:projectAppName: orangemeter-iot    # Combined project-app identifier
orangemeter-iot:environment: production            # Full environment name
orangemeter-iot:envTag: prd                        # Short environment tag
```

## Naming Patterns

### Primary Naming Variables

| Variable | Usage | Example | Description |
|----------|-------|---------|-------------|
| `projectName` | Base prefix for shared resources | `orangemeter` | Project-wide resources |
| `projectAppName` | Prefix for app-specific resources | `orangemeter-iot` | Application-specific resources |
| `appName` | Component identifier | `iot` | Service/application name |
| `envTag` | Environment suffix | `prd`, `dev`, `stg` | Short environment identifier |

### Resource Naming Structure

```
{prefix}-{component}-{service/purpose}[-{environment}]
```

Where:
- **prefix**: `projectName` or `projectAppName` based on scope
- **component**: Logical component type (see Component Types section)
- **service/purpose**: Specific function or service name
- **environment**: Optional environment suffix for environment-specific resources

## Component Types and Naming Patterns

### 1. Lambda Functions

**Pattern**: `{projectAppName}-{lambdaFunctionName}`

```typescript
// Examples from existing code:
const lambdaRole = new aws.iam.Role(`${projectAppName}-lambdaRole`, {
    // orangemeter-iot-lambdaRole
});

const buildLambda = new command.local.Command(`${projectAppName}-build`, {
    // orangemeter-iot-build
});

// Lambda function with descriptive Pulumi name vs clean AWS name
const lambdaFunc = new aws.lambda.Function(`${projectAppName}-lambda-func`, {
    name: `${projectAppName}`, // Clean AWS name without -lambda-func suffix
    // Pulumi: orangemeter-iot-metrics-importer-sqs-lambda-func (descriptive)
    // AWS:    orangemeter-iot-metrics-importer-sqs (clean)
});
```

**Lambda-specific naming**:
- **Function Pulumi Name**: `{projectAppName}-lambda-func` (descriptive for code clarity)
- **Function AWS Name**: `{projectAppName}` (clean, no redundant suffixes)
- **Role**: `{projectAppName}-lambdaRole` 
- **Policy**: `{projectAppName}-lambda-{policyType}`
- **Log Group**: `/aws/lambda/{functionName}` (AWS default)

### 2. SQS Queues

**Pattern**: `{projectName}-{queuePurpose}[-{queueType}]`

```typescript
// Examples:
const metricsQueue = new aws.sqs.Queue(`${projectName}-metrics`, {
    name: `${projectName}-metrics`,
    // orangemeter-metrics
});

const metricsDeadLetterQueue = new aws.sqs.Queue(`${projectName}-metrics-dlq`, {
    name: `${projectName}-metrics-dlq`,
    // orangemeter-metrics-dlq
});
```

**Queue types**:
- Main queues: `{projectName}-{purpose}`
- Dead letter queues: `{projectName}-{purpose}-dlq`
- FIFO queues: `{projectName}-{purpose}-fifo`

### 3. DynamoDB Tables

**Pattern**: `{projectAppName}-{tablePurpose}`

```typescript
const dynamodbTable = new aws.dynamodb.Table(`${projectAppName}-replaced-values`, {
    name: `${projectAppName}-replaced-values`,
    // orangemeter-iot-replaced-values
});
```

### 4. S3 Buckets

**Pattern**: `{projectName}-{bucketPurpose}`

```typescript
const importBucket = new aws.s3.Bucket(`${projectName}-import`, {
    bucket: `${projectName}-import`,
    // orangemeter-import
});
```

### 5. IAM Resources

**Default Pattern**: Use `{projectAppName}` for both Pulumi and AWS resource names
**Roles Pattern**: `{projectAppName}-{roleType}Role`
**Policies Pattern**: `{projectAppName}-{policyPurpose}-policy`
**Groups Pattern**: `{projectAppName}-{groupPurpose}-group`

```typescript
// Examples - Default approach using projectAppName:
const lambdaRole = new aws.iam.Role(`${projectAppName}-lambdaRole`);
// orangemeter-iot-lambdaRole

const dynamoDbAccessPolicy = new aws.iam.Policy(`${projectAppName}-dynamodb-access-policy`, {
    name: `${projectAppName}-dynamodb-access-policy`, // Same as Pulumi name
});
// Both Pulumi and AWS: orangemeter-iot-dynamodb-access-policy

// Exceptions for shared/infrastructure resources:
const iotServersGroup = new aws.iam.Group(`${projectName}-iot-servers-group`, {
    name: `${projectName}-iot-servers`, // Shared across projects
});
// Pulumi: orangemeter-iot-servers-group
// AWS:    orangemeter-iot-servers (shared resource)

const metricsQueuePolicy = new aws.iam.GroupPolicy(`${projectName}-metrics-sqs-policy`);
// orangemeter-metrics-sqs-policy (shared queue policy)
```

**Naming Consistency Rule**: 
- **Default**: Use `projectAppName` for both Pulumi resource name and AWS resource name
- **Exceptions**: Use `projectName` only for truly shared/infrastructure resources that span multiple applications

### 6. CloudWatch Resources

**Alarms Pattern**: `{projectName}-{component}-{alarmType}-alarm`
**Log Groups Pattern**: `/aws/{service}/{functionName}` (AWS default)

```typescript
new aws.cloudwatch.MetricAlarm(`${projectName}-metrics-queue-alarm`, {
    name: pulumi.interpolate`${projectName}-sqs-${queueName}-too-many-messages`,
    // orangemeter-metrics-queue-alarm
    // name: orangemeter-sqs-orangemeter-metrics-too-many-messages
});
```

## Environment-Specific Naming

### Development/Testing Environments

For non-production environments, consider adding environment suffixes:

```typescript
// Pattern for environment-specific resources
const resourceName = environment === 'production' 
    ? `${projectName}-{component}` 
    : `${projectName}-{component}-${envTag}`;

// Examples:
// Production: orangemeter-metrics
// Development: orangemeter-metrics-dev
// Staging: orangemeter-metrics-stg
```

### Multi-Environment Resources

Some resources may need explicit environment identification:

```typescript
// For resources that need clear environment separation
const environmentSpecificResource = `${projectAppName}-{component}-${envTag}`;
// orangemeter-iot-lambda-prd
// orangemeter-iot-lambda-dev
```

## Pulumi Resource Names vs AWS Resource Names

### Pulumi Resource Names
- Used within Pulumi code for resource identification
- Follow the patterns above
- Must be unique within the Pulumi project

### AWS Resource Names
- Actual names used in AWS console
- Often match Pulumi resource names but can differ
- Must follow AWS naming constraints

```typescript
// Pulumi resource name vs AWS resource name
const myQueue = new aws.sqs.Queue(`${projectName}-metrics`, {
    name: `${projectName}-metrics`, // AWS name
});
// Pulumi name: orangemeter-metrics (used in code)
// AWS name: orangemeter-metrics (shown in console)
```

## Special Naming Considerations

### 1. Resource Name Length Limits

Some AWS resources have name length limitations:
- **S3 Buckets**: 3-63 characters
- **DynamoDB Tables**: 3-255 characters  
- **Lambda Functions**: 1-64 characters
- **SQS Queues**: 1-80 characters

### 2. Character Restrictions

Follow AWS naming rules strictly:
- **Use lowercase letters, numbers, and hyphens only**
- **No underscores in most AWS resource names**
- **No spaces or special characters in AWS resource names**
- **Must start and end with alphanumeric characters**

```typescript
// ✅ Correct - Using hyphens consistently
const lambdaSg = new aws.ec2.SecurityGroup(`${projectAppName}-lambda-sg`, {
    name: `${projectAppName}-lambda-sg`, // Hyphens, no spaces
    description: "Security group for Lambda metrics importer",
});

// ❌ Incorrect - Using spaces in AWS resource name
const lambdaSg = new aws.ec2.SecurityGroup(`${projectAppName}-lambda-sg`, {
    name: `${projectAppName} lambda sg`, // Spaces violate AWS naming rules
});
```

**Critical**: Security Groups, Lambda functions, and most AWS resources must use hyphens instead of spaces in their names. Spaces can cause deployment issues and violate AWS naming constraints.

### 3. Global Uniqueness Requirements

Some resources require globally unique names:
- **S3 Buckets**: Must be globally unique
- **IAM Roles/Policies**: Unique within AWS account
- **Lambda Functions**: Unique within region

## File Organization and Module Naming

### Source File Naming

Files should be named according to their primary component:

```
src/
├── config.ts              # Configuration and common utilities
├── lambda_{service}_sqs.ts # Lambda functions (by trigger type)
├── lambda_{service}_s3.ts  # Lambda functions (by trigger type)  
├── sqs.ts                 # SQS queues and related policies
├── dynamodb.ts            # DynamoDB tables and policies
├── s3.ts                  # S3 buckets and policies
├── alarm.ts               # CloudWatch alarms
└── gitlab.ts              # GitLab-specific resources
```

### Export Naming Convention

```typescript
// Consistent export naming pattern
export const {resourceType}{Purpose}[Property] = resource.property;

// Examples:
export const metricsQueueArn = metricsQueue.arn;
export const metricsQueueName = metricsQueue.name;
export const dynamodbTableName = dynamodbTable.name;
export const iotServersGroupName = iotServersGroup.name;
```

## Implementation Guidelines

### 1. Configuration-Based Naming

Always use configuration variables for naming:

```typescript
import { projectName, projectAppName } from './config';

// ✅ Correct
const resource = new aws.service.Resource(`${projectName}-component`);

// ❌ Incorrect  
const resource = new aws.service.Resource('hardcoded-name');
```

### 2. Consistent Prefix Usage

**Default Rule**: Use `projectAppName` for most resources unless they are truly shared infrastructure.

```typescript
// Default: Use projectAppName for application-specific resources
const appTable = new aws.dynamodb.Table(`${projectAppName}-data`);
const lambdaRole = new aws.iam.Role(`${projectAppName}-lambdaRole`);
const appPolicy = new aws.iam.Policy(`${projectAppName}-policy`, {
    name: `${projectAppName}-policy`, // Same prefix for AWS name
});

// Exception: Use projectName only for shared/infrastructure resources
const sharedQueue = new aws.sqs.Queue(`${projectName}-metrics`);
const sharedGroup = new aws.iam.Group(`${projectName}-iot-servers-group`);
```

### 3. Descriptive Suffixes

Use clear, descriptive suffixes:

```typescript
// ✅ Clear purpose
const metricsDeadLetterQueue = new aws.sqs.Queue(`${projectName}-metrics-dlq`);
const lambdaExecutionRole = new aws.iam.Role(`${projectAppName}-lambdaRole`);

// ❌ Ambiguous
const queue2 = new aws.sqs.Queue(`${projectName}-queue2`);
const role1 = new aws.iam.Role(`${projectAppName}-role1`);
```

## Validation Checklist

When creating new resources, verify:

- [ ] Uses appropriate configuration variables (default: `projectAppName`, exceptions: `projectName` for shared resources)
- [ ] Follows established component naming patterns
- [ ] Includes descriptive purpose/service identifier
- [ ] **Respects AWS character and length limitations (no spaces, use hyphens)**
- [ ] **AWS resource names match Pulumi resource names (consistent naming)**
- [ ] **Lambda functions use descriptive Pulumi names (`-lambda-func`) but clean AWS names**
- [ ] Maintains consistency with existing resources in the same category
- [ ] Uses lowercase letters and hyphens (no underscores or spaces)
- [ ] Exports follow the established naming convention

## Examples by Resource Type

### Complete Lambda Function Example

```typescript
const appName = 'metrics-importer-sqs';
const projectAppName = `${projectName}-${appName}`;

// Lambda function - Descriptive Pulumi name, clean AWS name
const lambdaFunc = new aws.lambda.Function(`${projectAppName}-lambda-func`, {
    name: `${projectAppName}`, // Clean AWS name without redundant suffix
    // Pulumi: orangemeter-iot-metrics-importer-sqs-lambda-func
    // AWS:    orangemeter-iot-metrics-importer-sqs
});

// Lambda role using projectAppName consistently
const lambdaRole = new aws.iam.Role(`${projectAppName}-lambdaRole`);

// Lambda build command
const buildLambda = new command.local.Command(`${projectAppName}-build`);

// Lambda policy attachments
new aws.iam.RolePolicyAttachment(`${projectAppName}-lambda-role-policy`);
new aws.iam.RolePolicyAttachment(`${projectAppName}-lambda-VPC-Access`);

// Security group with hyphens, no spaces
const lambdaSg = new aws.ec2.SecurityGroup(`${projectAppName}-lambda-sg`, {
    name: `${projectAppName}-lambda-sg`, // Hyphens consistently
});
```

### Complete SQS Resources Example

```typescript
// Main queue
const metricsQueue = new aws.sqs.Queue(`${projectName}-metrics`, {
    name: `${projectName}-metrics`,
});

// Dead letter queue
const metricsDeadLetterQueue = new aws.sqs.Queue(`${projectName}-metrics-dlq`, {
    name: `${projectName}-metrics-dlq`,
});

// Queue policy
const metricsQueuePolicy = new aws.iam.GroupPolicy(`${projectName}-metrics-sqs-policy`);
```

### Complete Monitoring Example

```typescript
// CloudWatch alarm
new aws.cloudwatch.MetricAlarm(`${projectName}-metrics-queue-alarm`, {
    name: pulumi.interpolate`${projectName}-sqs-${queueName}-too-many-messages`,
});

// Dead letter queue alarm
new aws.cloudwatch.MetricAlarm(`${projectName}-metrics-dead-letter-queue-alarm`, {
    name: pulumi.interpolate`${projectName}-sqs-${deadLetterQueueName}-too-many-messages`,
});
```

## Integration with Tagging Strategy

This naming convention works in conjunction with the established tagging strategy. Resource names should align with tag values:

```typescript
// Resource name and tags should be consistent
const resource = new aws.service.Resource(`${projectName}-metrics-queue`, {
    tags: mergeTags({
        ResourceType: "SQSQueue",
        Component: "metrics",      // Matches name component
        Service: "main",           // Matches name service
    }),
});
```

## Migration and Updates

When updating existing resources:

1. **Maintain Consistency**: New resources should follow this convention
2. **Gradual Migration**: Update non-critical resources first
3. **Documentation**: Update this document when patterns evolve
4. **Team Review**: Have naming changes reviewed by the team

## AI Agent Instructions

When implementing infrastructure changes:

1. **Read Configuration**: Always import and use variables from `./config`
2. **Default to projectAppName**: Use `projectAppName` for both Pulumi and AWS resource names unless the resource is truly shared infrastructure
3. **Lambda Functions**: Use descriptive Pulumi names (`${projectAppName}-lambda-func`) but clean AWS names (`${projectAppName}`)
4. **No Spaces in AWS Names**: Always use hyphens instead of spaces in AWS resource names (critical for Security Groups and other resources)
5. **Follow Patterns**: Match the established naming patterns for the resource type
6. **Check Examples**: Reference existing resources of the same type for consistency
7. **Validate Names**: Ensure names meet AWS constraints and conventions (no spaces, no underscores)
8. **Update Exports**: Follow the export naming convention for new resources
9. **Apply Tags**: Use the `mergeTags` function with appropriate resource-specific tags

This naming convention ensures that all infrastructure resources are consistently named, easily identifiable, and maintainable across the entire project. 