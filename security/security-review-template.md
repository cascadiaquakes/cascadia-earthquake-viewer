# CRESCENT Cyberinfrastructure Security Review Template

**Aligned with Trusted CI Framework — Pillar 4: Controls (Must 15: Baseline Control Set)**

---

## Tool Information

| Field | Value |
|---|---|
| Tool Name | |
| Repository | |
| Production URL | |
| Review Date | |
| Reviewer | William Marfo, Trusted CI Fellow |
| Version/Commit | |

---

## 1. Identity & Access Management

| Check | Status | Notes |
|---|---|---|
| IAM roles follow least privilege | | |
| No AdministratorAccess on automation roles | | |
| Deployment permissions restricted to CI/CD | | |
| OIDC used (no long-lived credentials) | | |
| MFA enabled on AWS console accounts | | |

## 2. CI/CD Security

| Check | Status | Notes |
|---|---|---|
| GitHub Actions uses OIDC authentication | | |
| Branch protection enabled on production branch | | |
| PRs required before merge to production | | |
| CI status checks required before merge | | |
| Manual confirmation gate on production deploys | | |
| No secrets hardcoded in workflow files | | |

## 3. Secrets Management

| Check | Status | Notes |
|---|---|---|
| No secrets committed to repository | | |
| Secrets stored in GitHub Secrets or AWS Secrets Manager | | |
| API keys are rotatable | | |
| .gitignore covers sensitive files | | |
| No secrets in client-side JavaScript | | |

## 4. Dependency Security

| Check | Status | Notes |
|---|---|---|
| npm audit run (frontend) | | |
| pip audit run (backend/infra) | | |
| No critical vulnerabilities | | |
| Dependencies pinned (package-lock.json) | | |
| Docker base images up to date | | |

## 5. Infrastructure Security

| Check | Status | Notes |
|---|---|---|
| S3 buckets not publicly writable | | |
| S3 public access block enabled | | |
| CloudFront configured with HTTPS | | |
| CloudFront origin access control in place | | |
| Database not publicly accessible | | |
| Security groups restrict access appropriately | | |

## 6. Network Exposure

| Check | Status | Notes |
|---|---|---|
| No unnecessary open ports | | |
| API endpoints behind CloudFront | | |
| Database ports not exposed to internet | | |
| Admin interfaces not publicly accessible | | |

## 7. Application Security

| Check | Status | Notes |
|---|---|---|
| CORS policy restricted to known origins | | |
| User input validated on API endpoints | | |
| Error messages do not leak sensitive data | | |
| No debug mode in production | | |
| Cache-control headers set appropriately | | |

## 8. Logging & Monitoring

| Check | Status | Notes |
|---|---|---|
| CloudFront access logs enabled | | |
| S3 access logs enabled | | |
| CI/CD deployment logs available | | |
| Application error logging in place | | |

---

## Findings Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**Severity Levels:** Critical / High / Medium / Low / Informational

---

## Recommendations

1. 
2. 
3. 

---

## Overall Security Posture

_Summary statement about the tool's security maturity._
