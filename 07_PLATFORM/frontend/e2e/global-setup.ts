import { APIRequestContext, request } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, ".auth");
export const ADMIN_STORAGE_STATE = path.join(AUTH_DIR, "admin.json");
export const CONTRIBUTOR_STORAGE_STATE = path.join(AUTH_DIR, "contributor.json");

export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8082";
export const TEST_CONTRIBUTOR_USERNAME = "e2e-fixture-contributor";
const TEST_CONTRIBUTOR_PASSWORD = "e2e-fixture-pass-12345";

type LoginBody = { access_token: string; username: string; role: string };

export async function loginViaApi(
  context: APIRequestContext,
  username: string,
  password: string,
): Promise<LoginBody> {
  const response = await context.post("/api/v1/auth/login", { data: { username, password } });
  if (!response.ok()) {
    throw new Error(`login failed for ${username} (${response.status()})`);
  }
  return (await response.json()) as LoginBody;
}

export function toStorageState(baseURL: string, body: LoginBody) {
  return {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: "academy_token", value: body.access_token },
          { name: "academy_username", value: body.username },
          { name: "academy_role", value: body.role },
        ],
      },
    ],
  };
}

async function ensureLoggedIn(
  context: APIRequestContext,
  storageStatePath: string,
  username: string,
  password: string,
): Promise<void> {
  if (fs.existsSync(storageStatePath)) return;
  const body = await loginViaApi(context, username, password);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(storageStatePath, JSON.stringify(toStorageState(E2E_BASE_URL, body)));
}

// Caches sessions for the seeded admin account and a fixture contributor
// account to disk as Playwright storageState, reused across every spec and
// every re-run of this suite within the same login-token lifetime
// (AUTH_TOKEN_EXPIRE_MINUTES, 24h by default). The login endpoint is
// rate-limited (LOGIN_RATE_LIMIT_PER_MINUTE, default 5/minute per IP); a
// suite that re-authenticated fresh on every run would burn through that
// budget after just two or three back-to-back runs. Delete `e2e/.auth/` to
// force fresh logins (e.g. after changing either account's password).
export default async function globalSetup(): Promise<void> {
  const adminContext = await request.newContext({ baseURL: E2E_BASE_URL });
  try {
    await ensureLoggedIn(adminContext, ADMIN_STORAGE_STATE, "admin", "admin");
  } catch (err) {
    throw new Error(
      `global-setup: admin login failed — is the stack up (docker compose up -d)? ${(err as Error).message}`,
    );
  }

  // Get-or-create a persistent contributor fixture account (not a per-run
  // throwaway) so its session can be cached the same way admin's is.
  const adminToken = (JSON.parse(fs.readFileSync(ADMIN_STORAGE_STATE, "utf-8")).origins[0].localStorage as {
    name: string;
    value: string;
  }[]).find((item) => item.name === "academy_token")!.value;

  const usersResponse = await adminContext.get("/api/v1/users", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const users = (await usersResponse.json()) as { username: string }[];
  const contributorExists = users.some((u) => u.username === TEST_CONTRIBUTOR_USERNAME);

  if (!contributorExists) {
    await adminContext.post("/api/v1/users", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: TEST_CONTRIBUTOR_USERNAME, password: TEST_CONTRIBUTOR_PASSWORD, role: "contributor" },
    });
  }

  await ensureLoggedIn(
    adminContext,
    CONTRIBUTOR_STORAGE_STATE,
    TEST_CONTRIBUTOR_USERNAME,
    TEST_CONTRIBUTOR_PASSWORD,
  );

  await adminContext.dispose();
}
