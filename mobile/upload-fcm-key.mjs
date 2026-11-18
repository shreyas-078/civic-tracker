import fs from "fs";
import os from "os";
import path from "path";

const home = os.homedir();
const state = JSON.parse(
    fs.readFileSync(path.join(home, ".expo", "state.json"), "utf8"),
);
const sessionSecret = state.auth.sessionSecret;
const accountId = state.auth.userId;

// Usage: node upload-fcm-key.mjs path/to/firebase-service-account.json
const keyPath = process.argv[2];
if (!keyPath) {
    console.error("Usage: node upload-fcm-key.mjs <path-to-service-account.json>");
    process.exit(1);
}
const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));

async function gql(query, variables) {
    const res = await fetch("https://api.expo.dev/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "expo-session": sessionSecret,
        },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

async function main() {
    // Step 1: Upload the Google Service Account key
    console.log("Uploading FCM V1 service account key...");
    const uploadResult = await gql(
        `mutation CreateKey($accountId: ID!, $input: GoogleServiceAccountKeyInput!) {
      googleServiceAccountKey {
        createGoogleServiceAccountKey(accountId: $accountId, googleServiceAccountKeyInput: $input) {
          id
          projectIdentifier
          clientEmail
        }
      }
    }`,
        {
            accountId,
            input: { jsonKey: JSON.stringify(key) },
        },
    );

    if (uploadResult.errors) {
        console.error(
            "Upload errors:",
            JSON.stringify(uploadResult.errors, null, 2),
        );
        // Key might already exist, try to find it
        const listResult = await gql(
            `query ListKeys($accountName: String!) {
        account {
          byName(accountName: $accountName) {
            googleServiceAccountKeys {
              id
              projectIdentifier
              clientEmail
            }
          }
        }
      }`,
            { accountName: "shreysal78" },
        );
        console.log("Existing keys:", JSON.stringify(listResult.data, null, 2));

        const keys =
            listResult.data?.account?.byName?.googleServiceAccountKeys || [];
        const matchingKey = keys.find(
            (k) => k.clientEmail === key.client_email,
        );
        if (matchingKey) {
            console.log("Found existing key:", matchingKey.id);
            await linkKey(matchingKey.id);
        } else {
            console.log("No matching key found. Available:", keys);
        }
        return;
    }

    const keyId =
        uploadResult.data.googleServiceAccountKey.createGoogleServiceAccountKey
            .id;
    console.log("Key uploaded:", keyId);

    await linkKey(keyId);
}

async function linkKey(keyId) {
    // Step 2: Find or create AndroidAppCredentials for the project
    const projectId = "bd271476-05a9-450c-bce3-4c877e18c855";

    // First, get the app credentials
    console.log("Looking up app credentials for project", projectId);
    const appResult = await gql(
        `query GetApp($projectId: String!) {
      app {
        byFullName(fullName: $projectId) {
          id
          slug
          androidAppCredentials {
            id
            applicationIdentifier
          }
        }
      }
    }`,
        { projectId: "@shreysal78/civictrack" },
    );
    console.log("App result:", JSON.stringify(appResult.data, null, 2));

    const app = appResult.data?.app?.byFullName;
    if (!app) {
        console.error("Could not find app");
        return;
    }

    const appId = app.id;
    let credentialsId = app.androidAppCredentials?.[0]?.id;

    if (!credentialsId) {
        // Create credentials
        console.log("Creating Android app credentials...");
        const createResult = await gql(
            `mutation CreateCreds($appId: ID!, $applicationIdentifier: String!) {
        androidAppCredentials {
          createAndroidAppCredentials(
            androidAppCredentialsInput: {}
            appId: $appId
            applicationIdentifier: $applicationIdentifier
          ) {
            id
          }
        }
      }`,
            { appId, applicationIdentifier: "com.civictrack.app" },
        );
        console.log(
            "Create creds result:",
            JSON.stringify(createResult, null, 2),
        );
        credentialsId =
            createResult.data?.androidAppCredentials
                ?.createAndroidAppCredentials?.id;
    }

    if (!credentialsId) {
        console.error("Could not find or create credentials");
        return;
    }

    // Step 3: Link the FCM V1 key - try introspection first to find the right mutation
    console.log("Linking FCM V1 key", keyId, "to credentials", credentialsId);

    // Try the setGoogleServiceAccountKeyForFcmV1 mutation name
    const linkResult = await gql(
        `mutation LinkFcm($credentialsId: ID!, $keyId: ID!) {
      androidAppCredentials {
        setGoogleServiceAccountKeyForFcmV1(
          id: $credentialsId
          googleServiceAccountKeyId: $keyId
        ) {
          id
          googleServiceAccountKeyForFcmV1 {
            id
            clientEmail
          }
        }
      }
    }`,
        { credentialsId, keyId },
    );

    if (linkResult.errors) {
        console.error(
            "Link errors:",
            JSON.stringify(linkResult.errors, null, 2),
        );
    } else {
        console.log(
            "Success! FCM V1 key linked:",
            JSON.stringify(linkResult.data, null, 2),
        );
    }
}

main().catch(console.error);
