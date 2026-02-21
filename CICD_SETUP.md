# CI/CD — Earthquake Catalog Viewer

## Overview

Automated CI/CD pipeline with dev/prod environment separation. All workflows use OIDC authentication (no stored AWS keys) and branch protection enforces code review before production changes.

| Environment | Branch | Deploy | URL |
|---|---|---|---|
| Dev | `dev` | Auto on push | `https://eqcat.cascadiaquakes.org/dev/index.html` |
| Prod | `main` | Manual | `https://eqcat.cascadiaquakes.org/` |

---

## Workflows

```
.github/workflows/
├── ci.yml                    # PR validation (frontend + backend + infra)
├── deploy-frontend.yml       # Production frontend deploy (manual)
├── deploy-frontend-dev.yml   # Dev frontend deploy (auto on push to dev)
├── deploy-backend.yml        # Backend deploy via ECR + SSM (manual)
└── deploy-infra.yml          # CDK infrastructure deploy (manual)
```

**CI** runs automatically on every pull request to `main` or `dev`. It validates the frontend build, backend Docker image, and CDK synth. No AWS credentials required.

**Deploy Frontend** and **Deploy Backend** are triggered manually from Actions with a confirmation gate — type `deploy` to proceed. This prevents accidental production changes.

**Deploy Frontend (Dev)** triggers automatically when frontend files are pushed to the `dev` branch.

**Deploy Infrastructure** runs `cdk diff` followed by `cdk deploy`. Use with caution — always review the diff output before proceeding. User data changes will replace the EC2 instance.

---

## Development Workflow

**Frontend changes:**

```
git checkout dev
git checkout -b feature/my-change
# make changes, commit, push
# open PR to dev → CI runs → merge → auto-deploys to dev
# preview at /dev/index.html
# open PR from dev → main → CI runs → merge
# Actions → Deploy Frontend → type "deploy" → live
```

**Backend changes** follow the same branch flow, but trigger **Deploy Backend** instead of Deploy Frontend after merging to `main`. There is no dev auto-deploy for backend since both environments share a single backend instance.

---

## Infrastructure

| Component | Resource |
|---|---|
| Frontend (prod) | `s3://crescent-react-hosting/earthquake-viewer/` |
| Frontend (dev) | `s3://crescent-react-hosting/earthquake-viewer/dev/` |
| CloudFront | `E2IF1UMW8RWSY0` → `eqcat.cascadiaquakes.org` |
| Backend EC2 | `i-01f4ed3c781a23aea` (us-west-2) |
| ECR | `818214664804.dkr.ecr.us-west-2.amazonaws.com/eq-api` |
| CDK Stack | `EarthquakeStack` |

**Backend services** (Docker Compose on EC2):
- `api-eq` — Express API (port 3002), image pulled from ECR
- `martin-eq` — Martin tile server (port 3000)
- `postgis-eq` — PostgreSQL/PostGIS (internal only, no public port)

---

## Repository Configuration

**GitHub Secrets** (`Settings → Secrets and variables → Actions`):
- `VITE_CESIUM_TOKEN` — Cesium Ion access token
- `VITE_MAPTILER_KEY` — MapTiler API key

**GitHub Variables:**
- `VITE_API_URL` — Production API base URL
- `VITE_TILE_URL` — Production tile server URL

**IAM:**
- `GitHubActionsDeployRole` trusts `cascadiaquakes/cascadia-earthquake-viewer` on `main` and `dev` branches via OIDC
- `BackendRole` includes SSM and ECR read permissions

**Branch Protection** on `main`:
- Requires pull request
- Requires CI status check to pass
- Requires branch to be up to date

---

## Database Recovery

If the EC2 instance is replaced (e.g., CDK redeploys with user data changes), restore the database:

```bash
aws ssm start-session --target <instance-id>
sudo su - ec2-user
cd ~/cascadia-earthquake-viewer
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 818214664804.dkr.ecr.us-west-2.amazonaws.com
docker-compose -f docker-compose.prod.yml up -d
aws s3 cp s3://crescent-react-hosting/temp/gis_FINAL_jan15_2026.dump /tmp/
docker cp /tmp/gis_FINAL_jan15_2026.dump postgis-eq:/tmp/
docker exec postgis-eq pg_restore -U postgres -d gis --clean --no-owner /tmp/gis_FINAL_jan15_2026.dump
docker-compose -f docker-compose.prod.yml restart api-eq martin-eq
```

Verify: `docker exec postgis-eq psql -U postgres -d gis -c "SELECT catalog_id, COUNT(*) FROM earthquake.events GROUP BY catalog_id;"`