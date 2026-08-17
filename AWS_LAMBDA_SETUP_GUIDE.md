# AWS Lambda & Serverless CI/CD Setup Guide (Steps 1 to 5)

This guide provides step-by-step instructions to configure **AWS IAM credentials**, **GitHub Repository Secrets**, and trigger automated deployments to **AWS Lambda** via **GitHub Actions** and the **Serverless Framework**.

---

## 📋 Overview of the Pipeline Architecture

```
                                      +--------------------+
                                      | GitHub Repository  |
                                      | (Push to `main`)   |
                                      +---------+----------+
                                                |
                                                v
                                      +--------------------+
                                      |   GitHub Actions   |
                                      | (deploy-lambda.yml)|
                                      +---------+----------+
                                                |
                       +------------------------+------------------------+
                       |                        |                        |
                       v                        v                        v
             +-------------------+    +--------------------+   +-------------------+
             | 1. Install & Build|    | 2. Prisma Generate |   | 3. Serverless SLS |
             |  (Node.js 20.x)   |    | (rhel-openssl-3.0) |   |    Deploy (prod)  |
             +-------------------+    +--------------------+   +---------+---------+
                                                                         |
                                                                         v
                                                               +-------------------+
                                                               |     AWS Cloud     |
                                                               |  - API Gateway    |
                                                               |  - AWS Lambda     |
                                                               |  - CloudWatch Logs|
                                                               +-------------------+
```

---

## 🛠️ Step 1: Lambda Handler (Configured ✅)

The Lambda entry point is defined in [`src/lambda.ts`](file:///d:/Mern%20stack%20P/routine%20ai/backend/src/lambda.ts).
- Uses `@codegenie/serverless-express` to bridge NestJS with AWS API Gateway / Lambda events.
- Caches NestJS bootstrap instance across warm invocations.
- Applies Global Validation Pipes, Filters, CORS, and Swagger API documentation.

---

## ⚙️ Step 2: Serverless Framework Config (Configured ✅)

The Serverless configuration is defined in [`serverless.yml`](file:///d:/Mern%20stack%20P/routine%20ai/backend/serverless.yml).
- **Runtime**: `nodejs20.x`
- **Memory**: `512MB`
- **Timeout**: `29s`
- **Events**: HTTP API (`*`) and REST API fallback (`/{proxy+}`)
- **Prisma Engines**: Packaged automatically for AWS Lambda Linux (`rhel-openssl-3.0.x`).

---

## 💻 Step 3: Local Verification & NPM Scripts (Configured ✅)

You can run and test serverless commands locally:

| Command | Purpose |
| :--- | :--- |
| `npm run sls:offline` | Run Lambda locally using `serverless-offline` plugin |
| `npm run sls:package` | Package build artifacts into `.serverless/` zip files |
| `npm run sls:deploy` | Deploy directly to development stage |
| `npm run sls:deploy:prod` | Deploy directly to production stage |

---

## 🚀 Step 4: GitHub Actions Workflow (Configured ✅)

Workflow defined in [`.github/workflows/deploy-lambda.yml`](file:///d:/Mern%20stack%20P/routine%20ai/backend/.github/workflows/deploy-lambda.yml).
- Automatically triggers on every push to branch `main`.
- Can also be manually triggered via GitHub Actions UI (`workflow_dispatch`).

---

## 🔐 Step 5: AWS IAM Authentication & GitHub Secrets Configuration

You have two ways to authenticate GitHub Actions with AWS. **Method A (IAM Role OIDC)** is already prepared for the role `routine-ai-github-actions` shown in your AWS console!

---

### Method A: Use IAM Role with GitHub OIDC (Recommended - No Long-lived Keys!)

Your role `arn:aws:iam::888577041177:role/routine-ai-github-actions` already has `AdministratorAccess`. Just ensure the **Trust relationship** is configured:

1. In the AWS IAM Console, click on your role **`routine-ai-github-actions`**.
2. Click on the **Trust relationships** tab -> **Edit trust policy**.
3. Paste the following policy (replace with your AWS account ID if needed):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::888577041177:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:Vija047/Remio-backend:*"
        }
      }
    }
  ]
}
```
*(Note: If you haven't created the OIDC Identity Provider in IAM yet, go to IAM -> **Identity providers** -> **Add provider** -> Choose **OpenID Connect** -> Provider URL: `https://token.actions.githubusercontent.com`, Audience: `sts.amazonaws.com`).*

---

### Method B: Use IAM User Access Keys (Alternative)

If you prefer using static access keys (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`):

1. In the AWS Console, go to **IAM** -> **Users** -> **Create user** (e.g. `routine-ai-serverless-deployer`).
2. Attach `AdministratorAccess` policy.
3. Open the user -> **Security credentials** tab -> **Create access key** -> Choose **Command Line Interface (CLI)**.
4. Copy the **Access Key ID** and **Secret Access Key**.

---

### 3. Add GitHub Repository Secrets

1. Navigate to your GitHub Repository: [https://github.com/Vija047/Remio-backend](https://github.com/Vija047/Remio-backend)
2. Go to **Settings** -> **Secrets and variables** -> **Actions**.
3. Click **New repository secret** for the required application secrets:

| Secret Name | Required? | Description | Example / Note |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | Neon / RDS PostgreSQL Connection URL | `postgresql://user:pass@ep-host.aws.neon.tech/dbname?sslmode=require` |
| `JWT_SECRET` | **Yes** | Secret key for JWT auth tokens | e.g. `your-super-strong-jwt-secret-key-32chars` |
| `JWT_EXPIRES_IN` | Optional | JWT Token expiration duration | `7d` |
| `OPENROUTER_API_KEY` | Optional | OpenRouter AI API Key | `sk-or-v1-...` |
| `OPENROUTER_BASE_URL`| Optional | OpenRouter Base API URL | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL`   | Optional | AI Model identifier | `openai/gpt-5-chat` |
| `AWS_REGION`         | Optional | AWS Deployment Region (defaults to `us-east-1`) | `us-east-1` or `ap-south-1` |
| `AWS_ACCESS_KEY_ID`  | If Method B | IAM Access Key ID (only needed for Method B) | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY`| If Method B | IAM Secret Access Key (only needed for Method B) | `wJalrXUtnFEMI/K7MDENG/bPxRfiCY...` |

---

## 🎯 Step 6 & 7: Trigger Deployment & Verify

### Trigger Deployment:
Commit and push your changes to `main`:
```bash
git add .
git commit -m "feat: setup AWS Lambda CI/CD with Serverless Framework"
git push origin main
```

### Review Deployment:
1. Open GitHub and navigate to the **Actions** tab.
2. Select **Deploy to AWS Lambda**.
3. Watch the workflow execute.
4. Once completed, check the workflow summary or Serverless output for the generated HTTP API endpoint URL (e.g. `https://xxxxxx.execute-api.us-east-1.amazonaws.com/api`).
5. Test the endpoint:
   ```bash
   curl https://<api-id>.execute-api.us-east-1.amazonaws.com/api/tasks
   ```
6. Access Swagger docs at:
   `https://<api-id>.execute-api.us-east-1.amazonaws.com/api/docs`
