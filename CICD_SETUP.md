# CI/CD Setup Guide — Earthquake Catalog Viewer

## Workflow Files



```
.github/workflows/
├── ci.yml               # Runs on PRs to main
├── deploy-frontend.yml  # Manual production deploy
```

---


### `ci.yml` (Continuous Integration)

**Trigger:** Every pull request to `main`

**Steps:**
1. Installs frontend dependencies (`npm ci`)
2. Builds Vite frontend (catches build errors before merge)
3. Validates CDK infrastructure (`cdk synth`)
4. Uploads `dist/` and `cdk.out/` as artifacts for review

**No AWS credentials needed.** Pure validation only.

### `deploy-frontend.yml` (Production Deploy)

**Trigger:** Manual only — go to Actions → Deploy Frontend → Run workflow

**Safety:**  Type `deploy` in the confirmation field. This prevents accidental production deployments.

**Steps:**
1. Builds frontend with production Cesium token
2. Authenticates to AWS via OIDC (no stored keys)
3. Syncs `dist/` to `s3://crescent-react-hosting/earthquake-viewer/`
4. Invalidates CloudFront cache
5. Smoke tests `https://eqcat.cascadiaquakes.org/`

---

## One-Time Repository Setup

### 1. GitHub Secret (required)

Go to **repo Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
|---|---|
| `VITE_CESIUM_TOKEN` | Your Cesium Ion access token |

### 2. IAM Trust Policy (already done)

The `GitHubActionsDeployRole` must trust this repo. Add to the trust policy:

```
repo:cascadiaquakes/cascadia-earthquake-viewer:ref:refs/heads/main
```

### 3. IAM Permissions

The `GitHubActionsDeployRole` needs these permissions:

- `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on `crescent-react-hosting`
- `cloudfront:CreateInvalidation` on distribution `E2IF1UMW8RWSY0`

### 4. Branch Protection (recommended)

Go to **repo Settings → Branches → Add rule** for `main`:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass (select `build-and-validate`)
- ✅ Require branches to be up to date

---

## Developer Workflow

```
1. Create feature branch:    git checkout -b feature/my-change
2. Make changes, commit, push
3. Open PR to main           → CI runs automatically
4. Review + merge PR
5. Go to Actions → Deploy Frontend → Run workflow → type "deploy"
6. Verify at https://eqcat.cascadiaquakes.org/
```

---

## Notes

- **Frontend deploy is decoupled from CDK.** We no longer need `cdk deploy` to update the frontend. The S3 sync replaces the CDK `BucketDeployment` for day-to-day changes.

- **CDK deploy is separate.** For infrastructure changes (EC2, CloudFront config, security groups), run `cdk deploy` manually or via a future `deploy-infra.yml` workflow.

- **Cache strategy:** HTML files (`index.html`, `viewer3d.html`) are served with `no-cache` so users always get the latest. All other assets (JS, CSS, images) use long-lived cache with immutable flag since Vite hashes filenames.

---

## Phase 2 (Future)

When ready, add:
- `deploy-backend.yml` — Build Docker images → push to ECR → SSM into EC2 → pull + restart
- `deploy-infra.yml` — Manual CDK deploy for infrastructure changes
