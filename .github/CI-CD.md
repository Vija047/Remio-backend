# Backend CI/CD Pipeline

This document describes the automated CI/CD workflows configured for the RoutineAI backend.

## Workflows

### 1. **CI Workflow** (`.github/workflows/ci.yml`)
Runs on every push to `main` and `develop` branches, and on all pull requests.

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Changes to backend code or workflow file

**Steps:**
1. **Checkout** - Clone the repository
2. **Setup Node.js** - Install Node.js (18.x and 20.x)
3. **Install Dependencies** - Run `npm ci`
4. **Prisma Setup** - Generate Prisma client and run migrations
5. **Linting** - Run ESLint to check code quality
6. **Format Check** - Verify Prettier formatting
7. **Build** - Build the NestJS application
8. **Unit Tests** - Run Jest tests with coverage
9. **E2E Tests** - Run end-to-end tests
10. **Upload Coverage** - Send coverage reports to Codecov

**Database:**
- Uses PostgreSQL 15 container for testing
- Credentials: `test:test`
- Database: `routine_ai_test`

### 2. **Deploy Workflow** (`.github/workflows/deploy.yml`)
Runs after successful CI on the `main` branch.

**Triggers:**
- Push to `main` with backend changes
- Successful completion of CI workflow on `main`

**Steps:**
1. **Checkout** - Clone the repository
2. **Setup Node.js** - Install Node.js 20.x
3. **Install Dependencies** - Run `npm ci`
4. **Prisma Setup** - Generate Prisma client
5. **Build** - Build for production
6. **Create Artifact** - Package dist, node_modules, and Prisma schema
7. **Upload Artifact** - Store for 30 days
8. **Deploy** - (Commented out) Configure with your deployment platform

**Deployment Options:**
The workflow includes commented-out sections for:
- Heroku deployment
- Docker Hub deployment
- AWS/Digital Ocean deployment

### 3. **Security Workflow** (`.github/workflows/security.yml`)
Runs on schedule and when dependencies change.

**Triggers:**
- Every Monday at 8:00 AM UTC
- Changes to `package.json` or `package-lock.json`
- Pull requests affecting dependencies

**Steps:**
1. **NPM Audit** - Check for known vulnerabilities
2. **Snyk Scan** - Advanced security scanning (requires SNYK_TOKEN)
3. **Outdated Dependencies** - Report outdated packages
4. **CodeQL Analysis** - GitHub's code quality and security analysis

## Environment Variables

### Required for CI/CD:
- `DATABASE_URL` - PostgreSQL connection string (CI uses test database)

### Optional for Enhanced Features:
- `SNYK_TOKEN` - For Snyk security scanning (optional)
- `CODECOV_TOKEN` - For Codecov reporting (optional)

### For Deployment (uncomment in `deploy.yml`):
- `HEROKU_API_KEY` - Heroku authentication
- `HEROKU_APP_NAME` - Heroku app name
- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password
- `DEPLOY_KEY` - SSH key for server deployment
- `DEPLOY_SERVER` - Server address for deployment

## Setting Up Secrets

To configure deployment and external services:

1. Go to GitHub repository settings
2. Navigate to **Secrets and variables** → **Actions**
3. Add repository secrets for your deployment platform
4. Example:
   ```
   HEROKU_API_KEY: your-heroku-api-key
   HEROKU_APP_NAME: your-app-name
   DOCKER_USERNAME: your-docker-username
   DOCKER_PASSWORD: your-docker-password
   ```

## GitHub Environment Configuration

For enhanced deployment safety, configure environments in GitHub:

1. Go to **Settings** → **Environments**
2. Create `production` environment
3. Add deployment secrets specific to production
4. Configure required reviewers for production deployments

## Coverage Reports

Coverage reports are automatically uploaded to [Codecov](https://codecov.io):

1. Sign up on codecov.io
2. Link your GitHub repository
3. Coverage badges will appear on your README

## Local Testing

Before pushing, you can run the same checks locally:

```bash
cd backend

# Install dependencies
npm install

# Setup Prisma
npm run prisma:generate

# Run all checks
npm run lint          # Linting
npm run format        # Format check
npm run build         # Build
npm run test:cov      # Unit tests with coverage
npm run test:e2e      # E2E tests
```

## Troubleshooting

### Build Failures

**Issue:** Prisma generation fails
- **Solution:** Ensure `DATABASE_URL` is set correctly in workflow secrets
- Ensure your `.env` file is in `.gitignore`

**Issue:** Tests fail in CI but pass locally
- **Solution:** Check if database migrations are correct
- Verify environment variables are passed to test steps

### Coverage Upload Issues

**Issue:** Codecov integration not working
- **Solution:** Codecov can auto-detect without a token for public repos
- For private repos, add `CODECOV_TOKEN` to repository secrets

### Deployment Failures

**Issue:** Deploy step not running
- **Solution:** Ensure the deploy job has proper event triggers
- Check if previous CI job completed successfully
- Verify deployment platform secrets are configured

## Customization

### Adding More Test Steps

Edit `.github/workflows/ci.yml` and add before the coverage upload:

```yaml
- name: Custom test step
  run: npm run custom:test
  working-directory: backend
```

### Adding Deployment Platform

Edit `.github/workflows/deploy.yml` and uncomment/modify the deployment section for your platform.

### Changing Node Versions

Edit the `matrix.node-version` in `ci.yml`:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # Add or remove versions
```

### Modifying Schedule

Edit the `schedule` in `security.yml`:

```yaml
schedule:
  - cron: '0 8 * * 1'  # Monday 8 AM UTC
  # Other cron formats:
  # Daily: '0 0 * * *'
  # Weekly: '0 0 * * 0'
  # Monthly: '0 0 1 * *'
```

## Best Practices

1. **Always use `npm ci`** instead of `npm install` in CI for deterministic builds
2. **Use caching** to speed up dependency installation
3. **Separate concerns** - Keep CI, Deploy, and Security workflows separate
4. **Test on multiple Node versions** to ensure compatibility
5. **Use branch protection rules** - Require CI to pass before merging
6. **Monitor coverage trends** - Use Codecov to track coverage over time
7. **Review security alerts** - Address Snyk and CodeQL findings promptly
8. **Document secrets** - Keep track of which secrets are needed where

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Jest Documentation](https://jestjs.io/)
- [ESLint Documentation](https://eslint.org/docs/)
