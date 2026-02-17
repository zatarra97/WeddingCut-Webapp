import * as pulumi from "@pulumi/pulumi";
import * as gitlab from "@pulumi/gitlab";
import {
    glabToken,
    glabProjectId,
    projectAppName
} from "./config";

// Get the Gitlab token from the environment variables
const gitlabProvider = new gitlab.Provider(`${projectAppName}-glab-provider`, { token: glabToken });


let projectRepoUrl: pulumi.Output<string>;
let projectId: pulumi.Output<string>;

// PRODUCTION ONLY
if (pulumi.getStack() === "production") {
    // Protect tags starting with "v*"
    const tagProtection = new gitlab.TagProtection(`${projectAppName}-glab-protect-v-tags`, {
        project: glabProjectId,
        tag: "v*", // Protect all tags starting with "v"
        createAccessLevel: "maintainer", // Only maintainers can create these tags
    }, {provider: gitlabProvider});

} else {
    // For non-production environments, set default values
    projectRepoUrl = pulumi.output("0");
    projectId = pulumi.output("0");
}
export const glabProvider = gitlabProvider;