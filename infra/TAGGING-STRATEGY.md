# Pulumi Tagging Strategy

This document outlines the comprehensive tagging strategy implemented for the Orange Ops infrastructure to ensure proper resource identification, cost allocation, and management.

## 🏗️ Architecture Overview

**Centralized Tagging System**: All tagging logic is centralized in `src/config.ts`:
- `commonTags`: Base tags applied to all resources
- `mergeTags()`: Helper function that combines common tags with resource-specific tags
- **All other files**: Import and use `mergeTags` from `./config` (never redefine it locally)

## Overview

All AWS resources created by this Pulumi stack are tagged with a consistent set of tags that identify:
- Which Pulumi stack created the resource
- Environment information
- Project and application details  
- Resource metadata for management

## Tag Structure

### Stack-Level Tags (Applied to All Resources)

These tags are automatically applied to all resources via Pulumi configuration:

```yaml
# Pulumi.yaml
pulumi:tags:
  value:
    pulumi:template: typescript
    Project: orange-ops
    ManagedBy: Pulumi
    Application: ansible-executor
    Owner: OrangeMeter
    Repository: orange-ops
    PulumiProject: orange-ops
```

### Environment-Specific Tags

Environment-specific tags are added via stack configuration files:

```yaml
# Pulumi.production.yaml
pulumi:tags:
  value:
    Environment: production
    EnvironmentType: prd
    Stack: production
    CostCenter: "OrangeMeter-Production"
    Backup: "required"
```

### Common Application Tags

These tags are defined in `config.ts` and applied via the `commonTags` object:

```typescript
export const commonTags = {
    Environment: environment,
    Project: config.require("projectName"),
    Stack: `${pulumi.getProject()}/${pulumi.getStack()}`,
    ManagedBy: "Pulumi",
    Application: config.require("appName"),
    Owner: "OrangeMeter",
    // CreatedDate removed to prevent unnecessary resource updates
    // Resource creation can be tracked via CloudTrail or AWS resource timestamps
};
```

### Resource-Specific Tags

Each resource can have additional tags that provide specific context:

- `ResourceType`: The type of AWS resource (e.g., Lambda, S3Object, SecurityGroup)
- `Component`: The logical component (e.g., lambda, influxdb, ansible)
- `Service`: Specific service identifier (e.g., telemetry-importer, ping, setup)

## Implementation

### Centralized Helper Function

**IMPORTANT**: The `mergeTags` helper function is **centralized in `config.ts`** and must be **imported** (not redefined) in all infrastructure files:

```typescript
// In src/config.ts - DEFINE HERE ONLY
export const mergeTags = (resourceTags: Record<string, string> = {}) => ({
    ...commonTags,
    ...resourceTags,
});
```

**DO NOT** create local `mergeTags` functions in individual resource files. Always import from `./config`.

#### Why Centralization?
- **Consistency**: Ensures all resources use identical tagging logic
- **Maintainability**: Changes to tagging logic only need to be made in one place
- **DRY Principle**: Eliminates code duplication
- **Type Safety**: Centralized function ensures consistent typing across all files

### Usage Example

```typescript
// Import mergeTags from config
import { mergeTags } from "./config";

const lambdaFunc = new aws.lambda.Function(`${projectAppName}-lambdaFunc`, {
    // ... other configuration
    tags: mergeTags({
        ResourceType: "Lambda",
        Component: "lambda", 
        Service: appName,
        Runtime: "nodejs20.x",
        Architecture: "arm64",
    }),
});
```

## AWS Service Tag Limits ⚠️

**Important**: Different AWS services have different tag limits. Always verify the tag limit for each service:

| Service | Tag Limit | Notes |
|---------|-----------|-------|
| **S3 Objects** | **10 tags** | Critical limit - deployment will fail if exceeded |
| EC2 Instances | 50 tags | Generous limit |
| Lambda Functions | 50 tags | Generous limit |
| RDS Instances | 50 tags | Generous limit |
| IAM Resources | 50 tags | Generous limit |

**Tag Calculation for S3 Objects:**
- Stack-level tags: 1
- Common tags (from config.ts): 6
- **Subtotal: 7 tags**
- **Remaining capacity: 3 tags** for resource-specific use

## Tag Categories by Resource Type

### Lambda Functions
- `ResourceType`: "Lambda"
- `Component`: "lambda"
- `Service`: Function purpose (e.g., "telemetry-importer", "ecs-scaling")
- `Runtime`: Runtime version
- `Architecture`: CPU architecture

### S3 Objects ⚠️ **10 Tag Limit**
**CRITICAL**: AWS S3 objects have a **strict limit of 10 tags maximum**. With stack-level (1) + common tags (6) = 7 base tags, only **3 additional tags** can be applied.

**Standard S3 Object Tags (within limit):**
- `ResourceType`: "S3Object" (required for consistency)
- `Component`: Purpose/component (e.g., "grafana-templates", "ansible-playbook")
- `Service`: Service identifier (e.g., "grafana", "ansible")

**❌ DO NOT add additional tags** like `FileType`, `PlaybookType`, `TemplateType`, etc. to S3 objects as they will exceed the AWS limit and cause deployment failures.

### InfluxDB Resources
- `ResourceType`: "InfluxDB" | "SecurityGroup" | "SSMParameter"
- `Component`: "influxdb"
- `Service`: "telemetry"
- `StorageSize`: Storage allocation
- `InstanceType`: Instance type

### SQS Queues
- `ResourceType`: "SQSQueue"
- `Component`: Queue purpose (e.g., "ansible", "telemetry")
- `Service`: Specific service (e.g., "command", "notify", "main", "dlq")
- `QueueType`: "FIFO" | "Standard" | "DLQ"
- `RetentionDays`: Message retention period

### IAM Resources
- `ResourceType`: "IAMUser" | "IAMRole" | "IAMPolicy"
- `Component`: Related service
- `Service`: Service identifier
- `UserType`: "service" for service accounts
- `RoleType`: "execution" for Lambda execution roles
- `PolicyType`: "service" for service policies

### CloudWatch Resources
- `ResourceType`: "LogGroup" | "CloudWatchAlarm"
- `Component`: "lambda" | "monitoring"
- `Service`: Associated service
- `RetentionDays`: Log retention period
- `AlarmType`: Type of alarm (e.g., "queue-depth")

## Benefits

1. **Stack Identification**: The `Stack` tag clearly identifies which Pulumi stack created each resource
2. **Cost Allocation**: Tags enable detailed cost tracking and allocation
3. **Environment Management**: Clear environment tagging for production/staging separation
4. **Automated Management**: Tags enable automated resource lifecycle management
5. **Compliance**: Consistent tagging supports governance and compliance requirements

## Best Practices for New Resources

When adding new resources:

1. **ALWAYS import `mergeTags` from `./config`** - Never create a local copy
2. Apply tags to ALL taggable resources
3. Include meaningful resource-specific tags
4. Follow the established naming conventions
5. Don't add tags on AWS resources that don't support it
6. Only import from config the values that are actually used in each file

## ⚠️ CRITICAL: Preserving Existing Name and Description Tags

**IMPORTANT**: When updating existing resources, **DO NOT override existing tags**. The following tags must be preserved exactly as they are:

- **`Name` tags**: Preserve existing `Name` tags exactly as-is
- **`Description` tags**: Preserve existing `Description` tags exactly as-is

### ✅ CORRECT: Updating Existing Resources

For resources that already have `Name` tags, use `mergeTags` **WITHOUT** the name parameter:

```typescript
// ✅ CORRECT - Preserve existing Name tag
const infraAlarmsTopic = new aws.sns.Topic(`${projectName}-infra-alarms`, {
    name: `${projectName}-infra-alarms`,
    tags: {
        Name: `${projectName}-infra-alarms`,           // ← PRESERVE existing Name tag
        Description: "SNS topic for infrastructure alarms", // ← PRESERVE existing custom tags
        // Add new structured tags using mergeTags
        ...mergeTags({
            ResourceType: "SNSTopic",
            Component: "monitoring",
            Service: "infra-alarms",
            Purpose: "alarm-notifications",
        }), // ← NO name parameter to avoid overriding existing Name tag
    },
});

// ✅ CORRECT - Another example with existing tags
const existingBucket = new aws.s3.Bucket(`${projectName}-existing-bucket`, {
    bucket: `${projectName}-data`,
    tags: {
        Name: `${projectName}-data`,                    // ← PRESERVE existing Name tag
        Environment: "legacy-production",               // ← PRESERVE existing custom tags
        // Add new structured tags
        ...mergeTags({
            ResourceType: "S3Bucket",
            Component: "storage",
            Service: "application-data",
            Versioning: "enabled",
        }), // ← NO name parameter
    },
});
```

### ❌ WRONG: Overriding Existing Name Tags

```typescript
// ❌ WRONG - This would override the existing Name tag
const infraAlarmsTopic = new aws.sns.Topic(`${projectName}-infra-alarms`, {
    name: `${projectName}-infra-alarms`,
    tags: mergeTags({
        ResourceType: "SNSTopic",
        Component: "monitoring",
        Service: "infra-alarms",
        Purpose: "alarm-notifications",
    }, `${projectName}-different-name`), // ← WRONG: This overrides existing Name tag
});
```

### ✅ CORRECT: Brand New Resources

For **completely new resources** that don't have existing `Name` tags, you can use the enhanced `mergeTags` with the name parameter:

```typescript
// ✅ CORRECT - New resource without existing Name tag
const newResource = new aws.service.Resource(`${projectName}-new-resource`, {
    // ... configuration
    tags: mergeTags({
        ResourceType: "ResourceType",
        Component: "component",
        Service: "service",
    }, `${projectName}-new-resource`), // ← OK to use name parameter for new resources
});
```

### Migration Strategy for Existing Resources

When updating existing infrastructure:

1. **Identify existing tags**: Check what `Name` and custom tags already exist
2. **Preserve all existing tags**: Keep existing `Name` and any custom tags
3. **Add structured tags**: Use `mergeTags` without name parameter to add the new standardized tags
4. **Use spread operator**: Combine existing tags with new structured tags

```typescript
// Migration pattern for existing resources
const existingResource = new aws.service.Resource(`${projectName}-existing`, {
    // ... configuration
    tags: {
        // PRESERVE existing tags exactly as they are
        Name: "existing-name-do-not-change",
        CustomTag: "existing-custom-value",
        LegacyEnvironment: "prod-legacy",

        // ADD new structured tags using spread operator
        ...mergeTags({
            ResourceType: "ResourceType",
            Component: "component", 
            Service: "service",
        }), // NO name parameter - preserves existing Name tag
    },
});
```

### AWS Resources That Don't Support Tagging

Some AWS resources do not support tagging and should not have tags applied:

- `aws.lambda.Alias`: Lambda aliases cannot be tagged
- `aws.iam.Group`: IAM groups cannot be tagged
- `aws.iam.GroupPolicy`: IAM group policies cannot be tagged
- `aws.iam.RolePolicy`: IAM role pololicies cannot be tagged
- `aws.route53.Record`: Route53 record cannot be tagged

### Critical Rule: ❌ DON'T DO THIS
```typescript
// ❌ WRONG - Do not create local mergeTags functions
const mergeTags = (resourceTags: Record<string, string> = {}) => ({
    ...commonTags,
    ...resourceTags,
});
```

### ✅ DO THIS INSTEAD
```typescript
// ✅ CORRECT - Always import mergeTags from config
import { mergeTags } from "./config";
```

### Examples for Different Scenarios

```typescript
import { mergeTags } from "./config";

// ✅ EXISTING RESOURCE: Preserve existing Name and custom tags
const existingResource = new aws.service.Resource("existing-name", {
    // ... configuration
    tags: {
        Name: "existing-resource-name",              // ← PRESERVE existing Name tag
        CustomTag: "existing-value",                 // ← PRESERVE existing custom tags
        // Add new structured tags
        ...mergeTags({
            ResourceType: "ResourceTypeName",
            Component: "component-name", 
            Service: "service-name",
        }), // ← NO name parameter to preserve existing Name tag
    },
});

// ✅ BRAND NEW RESOURCE: Can use mergeTags with name parameter
const newResource = new aws.service.Resource("new-name", {
    // ... configuration
    tags: mergeTags({
        ResourceType: "ResourceTypeName",
        Component: "component-name", 
        Service: "service-name",
        // Add other relevant tags (up to 43 more for most services)
    }, "new-resource-name"), // ← OK to use name parameter for new resources
});

// ⚠️ Special case: S3 Objects (10 tag limit) - EXISTING RESOURCE
const existingS3Object = new aws.s3.BucketObject("existing-s3-name", {
    // ... configuration
    tags: {
        Name: "existing-file.txt",                   // ← PRESERVE existing Name tag
        // Add new structured tags (limited by 10-tag limit)
        ...mergeTags({
            ResourceType: "S3Object",
            Component: "component-name",
            Service: "service-name",
        }), // ← NO name parameter, and limited tags due to 10-tag limit
        // ❌ DO NOT add more tags - already at 10 tag limit!
    },
});
```

## 🎯 Key Principles Summary

**For AI Agents and Developers implementing the tagging strategy:**

### 1. **NEVER Override Existing Name and Description Tags**
- If a resource already has a `Name` tag, preserve it exactly as-is
- If a resource already has a `Description` tag, preserve it exactly as-is
- Use `mergeTags` WITHOUT the name parameter for existing resources
- Use spread operator to combine existing tags with new structured tags

### 2. **New vs Existing Resources**
```typescript
// EXISTING RESOURCE: Preserve existing Name tag
tags: {
    Name: "existing-name",           // ← Keep existing Name tag
    ...mergeTags({ /* new tags */ }) // ← NO name parameter
}

// NEW RESOURCE: Can use mergeTags with name parameter  
tags: mergeTags({ /* new tags */ }, "new-name") // ← OK for new resources
```

### 3. **Resource Identification Pattern**
- **Existing resources**: Check if `Name` tag already exists before applying strategy
- **New resources**: Use `mergeTags` with name parameter for automatic `Name` tag
- **All resources**: Apply structured tags (ResourceType, Component, Service, etc.)

### 4. **Implementation Checklist**
- [ ] Import `mergeTags` from `./config` (never create local copy)
- [ ] Check if resource has existing `Name` and/or `Description` tags
- [ ] If existing `Name` or `Description` tags: preserve them and use spread operator
- [ ] If new resource: use `mergeTags` with name parameter
- [ ] Apply appropriate `ResourceType`, `Component`, `Service` tags
- [ ] Respect AWS service tag limits (especially S3 objects: 10 tags max)
- [ ] Do NOT tag unsupported resources (Lambda Aliases, IAM Groups, etc.)

## Querying Resources by Stack

To find all resources created by a specific stack:

```bash
# AWS CLI
aws resourcegroupstaggingapi get-resources \
    --tag-filters Key=Stack,Values=production

# AWS Console
# Use the Resource Groups service to create saved searches
# Filter by Stack=production
```

## Maintenance

- Review and update tags when resource purposes change
- Ensure new team members understand the tagging strategy
- Regularly audit tags for consistency
- Update documentation when adding new tag categories

## Stack Migration

When resources need to be moved between stacks:

1. Document the current tags
2. Plan the new tag values
3. Update the infrastructure code
4. Apply changes incrementally
5. Verify the new tags are applied correctly 
