# Security Assessment Report — Cascadia Earthquake Catalog Viewer

**Aligned with Trusted CI Framework — Pillar 4: Controls (Must 15: Baseline Control Set)**

---

## Tool Information

| Field | Value |
|---|---|
| Tool Name | Cascadia Earthquake Catalog Viewer |
| Repository | cascadiaquakes/cascadia-earthquake-viewer |
| Production URL | https://eqcat.cascadiaquakes.org |
| Review Date | March 2026 |
| Reviewer | William Marfo, Trusted CI Fellow |

---

## 1. Executive Summary

A cybersecurity best practices review was conducted for the Cascadia Earthquake Catalog Viewer, a web-based geospatial application for exploring peer-reviewed earthquake catalogs across the Cascadia region. The review evaluated identity and access management, CI/CD pipeline security, secrets management, dependency vulnerabilities, infrastructure configuration, network exposure, application-level security controls, and logging practices.

This assessment aligns with guidance from the Trusted CI Framework, particularly the Controls pillar which emphasizes adoption of baseline cybersecurity safeguards for research cyberinfrastructure.

---

## 2. Scope

**Application components reviewed:**
- Frontend (Vite + MapLibre + Cesium, hosted on S3 + CloudFront)
- Backend API (Express.js on EC2 via Docker)
- Martin tile server (Docker on EC2)
- PostGIS database (Docker on EC2)
- CI/CD pipeline (GitHub Actions with OIDC)
- CDK infrastructure stack

**Out of scope:**
- AWS account-level security (managed by EarthScope)
- DNS and certificate management
- End-user device security

---

## 3. Methodology

The review combined manual configuration analysis with automated vulnerability scanning.

**Manual review:**
- AWS IAM role policies and trust relationships
- GitHub repository settings and branch protection rules
- GitHub Actions workflow configurations
- Docker Compose configuration files
- Application CORS and API endpoint configuration
- S3 bucket policies and CloudFront distribution settings

**Automated scanning:**
- `npm audit` for frontend JavaScript dependencies
- Docker image vulnerability assessment
- AWS IAM policy review

---

## 4. Findings

### Finding 1 — Overly Broad IAM Role

**Severity:** High

**Description:** The `GitHubActionsDeployRole` used by all CI/CD workflows currently has the `AdministratorAccess` managed policy attached, granting unrestricted access to all AWS services and resources.

**Risk:** Compromise of a CI/CD workflow (e.g., through a malicious dependency or workflow injection) could allow full AWS account modification including data deletion, resource creation, and privilege escalation.

**Recommendation:** Replace `AdministratorAccess` with a scoped policy that grants only the permissions required for deployment: S3 sync, CloudFront invalidation, ECR push/pull, SSM SendCommand, and CloudFormation operations for the specific stack.

---

### Finding 2 — Database Accessible via Docker on EC2

**Severity:** Medium

**Description:** PostGIS runs as a Docker container on the same EC2 instance as the API and tile server. The `docker-compose.prod.yml` does not expose the database port publicly (good), but the database runs on the same host as the application with no network isolation.

**Risk:** If the EC2 instance or application container is compromised, the attacker has direct access to the database without needing to traverse network boundaries.

**Recommendation:** For future architecture, consider migrating to Amazon RDS with VPC security groups for network-level isolation. For current setup, ensure the EC2 security group does not expose PostgreSQL port (5432) externally.

---

### Finding 3 — No Automated Dependency Scanning

**Severity:** Medium

**Description:** The CI pipeline validates builds but does not run `npm audit` or any dependency vulnerability scanning as part of the CI/CD process.

**Risk:** Vulnerable packages could be deployed to production without detection.

**Recommendation:** Add `npm audit --audit-level=high` as a CI step and consider adding Gitleaks for secret detection scanning.

---

### Finding 4 — CORS Configuration (Good Practice Noted)

**Severity:** Informational

**Description:** The backend API restricts CORS to specific origins (`eqcat.cascadiaquakes.org` and the CloudFront domain), replacing a previous wildcard (`*`) configuration.

**Risk:** Low — current configuration follows best practices.

**Recommendation:** No action required. Maintain the allowlist approach.

---

### Finding 5 — OIDC Authentication (Good Practice Noted)

**Severity:** Informational

**Description:** All GitHub Actions workflows authenticate to AWS via OpenID Connect (OIDC), eliminating the need for long-lived AWS credentials stored as GitHub Secrets.

**Risk:** Low — this is industry best practice for CI/CD to cloud authentication.

**Recommendation:** No action required. Continue using OIDC.

---

### Finding 6 — Branch Protection (Good Practice Noted)

**Severity:** Informational

**Description:** Branch protection is enabled on `main` requiring pull requests and CI status checks before merging. Production deployments require manual confirmation.

**Risk:** Low — this follows standard deployment safety practices.

**Recommendation:** No action required.

---

## 5. Findings Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | GitHubActionsDeployRole has AdministratorAccess | High | Open |
| 2 | Database on same host as application (no network isolation) | Medium | Open |
| 3 | No automated dependency vulnerability scanning in CI | Medium | Open |
| 4 | CORS restricted to known origins | Informational | Good |
| 5 | OIDC authentication for CI/CD | Informational | Good |
| 6 | Branch protection with required reviews and CI checks | Informational | Good |

---

## 6. Recommendations

1. **Restrict IAM deployment role** — Replace AdministratorAccess with a least-privilege policy scoped to required services
2. **Add dependency scanning to CI** — Include `npm audit` and Gitleaks in the CI workflow
3. **Enable CloudFront and S3 access logging** — Ensure access logs are enabled for audit trail
4. **Consider database isolation** — Evaluate migration to RDS for network-level separation in future architecture

---

## 7. Overall Security Posture

The Cascadia Earthquake Catalog Viewer demonstrates several strong security practices including OIDC-based CI/CD authentication, CORS origin restrictions, branch protection with required reviews, and manual confirmation gates for production deployments. The primary area for improvement is reducing the scope of the IAM deployment role from full administrator access to least-privilege permissions. Adding automated dependency scanning to the CI pipeline would further strengthen the application's security posture.

The application is suitable for its current use as a research platform serving publicly available earthquake catalog data.
