# GitHub CI/CD Setup Guide

Follow these steps to enable the CI/CD pipelines in your GitHub repository.

## 1. Enable Workflows

Workflows are enabled by default. Verify they're active:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Actions** → **General**
3. Ensure "Allow all actions and reusable workflows" is selected
4. Click **Save**

## 2. Configure Repository Secrets

### For CI/CD Core (Database):
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:

```
Name: DATABASE_URL
Value: postgresql://username:password@localhost:5432/routine_ai_test
```

> Note: The CI workflow uses a PostgreSQL service container, so you don't need a real database. Use the test credentials.

### Optional: Codecov Integration

If you want coverage reports (optional):

1. Visit [codecov.io](https://codecov.io)
2. Sign up and connect your GitHub repository
3. For public repos, no token needed
4. For private repos, get the token and add as repository secret:

```
Name: CODECOV_TOKEN
Value: your-codecov-token
```

### Optional: Snyk Security Scanning

For advanced security scanning:

1. Visit [snyk.io](https://snyk.io)
2. Create account and connect GitHub
3. Get your API token from account settings
4. Add as repository secret:

```
Name: SNYK_TOKEN
Value: your-snyk-api-token
```

## 3. Configure Branch Protection Rules

Prevent merging without passing CI:

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Click **Add rule** and configure:

```
Pattern name: main
  ✓ Require a pull request before merging
  ✓ Require status checks to pass before merging
    - Select checks to require:
      * Backend CI / ci (18.x)
      * Backend CI / ci (20.x)
  ✓ Require branches to be up to date before merging
```

3. Click **Create**

Repeat for the `develop` branch if needed.

## 4. Configure Deployment Environment (Optional)

For production deployments:

1. Go to **Settings** → **Environments**
2. Click **New environment** and name it `production`
3. Configure **Environment secrets** with deployment credentials:

```
HEROKU_API_KEY=your-heroku-key
HEROKU_APP_NAME=your-app-name
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password
DEPLOY_KEY=your-ssh-key
DEPLOY_SERVER=your-server-ip
```

4. (Optional) Add **Required reviewers** for production deployments
5. Click **Save protection rules**

## 5. Verify Workflow Files

Ensure the workflow files are in the correct location:

```
backend/
  .github/
    workflows/
      ci.yml        ✓ Main CI workflow
      deploy.yml    ✓ Deployment workflow
      security.yml  ✓ Security scanning
```

Workflows should appear in the **Actions** tab if properly configured.

## 6. First Commit

Make an initial commit to trigger the workflows:

```bash
git add backend/.github/
git commit -m "add: CI/CD workflows"
git push origin main
```

Go to **Actions** tab and watch the workflows run!

## 7. Customization

### Deploy to Heroku

In `backend/.github/workflows/deploy.yml`, uncomment and modify:

```yaml
- name: Deploy to Heroku
  env:
    HEROKU_API_KEY: ${{ secrets.HEROKU_API_KEY }}
    HEROKU_APP_NAME: ${{ secrets.HEROKU_APP_NAME }}
  run: |
    npm install -g heroku
    heroku container:push web --app $HEROKU_APP_NAME
    heroku container:release web --app $HEROKU_APP_NAME
```

### Deploy to Docker Hub

In `backend/.github/workflows/deploy.yml`, uncomment and modify:

```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v2
  with:
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_PASSWORD }}

- name: Build and push Docker image
  uses: docker/build-push-action@v4
  with:
    context: ./backend
    push: true
    tags: |
      ${{ secrets.DOCKER_USERNAME }}/routine-ai-backend:latest
      ${{ secrets.DOCKER_USERNAME }}/routine-ai-backend:${{ github.sha }}
```

### Deploy to VPS/Dedicated Server

In `backend/.github/workflows/deploy.yml`, uncomment and modify:

```yaml
- name: Deploy via SSH
  env:
    DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
    DEPLOY_SERVER: ${{ secrets.DEPLOY_SERVER }}
    DEPLOY_USER: ubuntu  # Change to your user
  run: |
    mkdir -p ~/.ssh
    echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
    chmod 600 ~/.ssh/deploy_key
    ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no $DEPLOY_USER@$DEPLOY_SERVER << 'EOF'
      cd /path/to/your/app
      git pull origin main
      npm ci
      npm run build
      npm run prisma:deploy
      pm2 restart your-app-name
    EOF
```

## 8. Monitor Workflows

1. Go to **Actions** tab to view workflow runs
2. Click on a workflow run to see details
3. Click on a job to see step-by-step output
4. Review failed steps for error messages

## 9. Troubleshooting

### Workflows Not Running

**Check:**
1. `.github/workflows/*.yml` files exist and are properly formatted
2. GitHub Actions are enabled in **Settings** → **Actions**
3. No syntax errors in YAML files
4. Push event targets `main` or `develop` branch

### Tests Passing Locally but Failing in CI

**Check:**
1. Environment variables are properly set
2. Node version matches (18.x, 20.x)
3. Database migrations are included in git
4. `package-lock.json` is committed
5. No hardcoded paths or OS-specific commands

### Coverage Not Uploading

**Check:**
1. Coverage reports are generated (`npm run test:cov`)
2. Codecov token is set (if private repo)
3. Coverage path is correct in workflow

## 10. Performance Tips

### Speed Up Builds

1. **Cache npm dependencies:**
   ```yaml
   - uses: actions/setup-node@v4
     with:
       node-version: '20.x'
       cache: 'npm'
       cache-dependency-path: 'backend/package-lock.json'
   ```

2. **Skip unnecessary checks on draft PRs:**
   ```yaml
   if: !github.event.pull_request.draft
   ```

3. **Use concurrency to cancel old runs:**
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```

## Next Steps

1. ✅ Add workflow files (already done)
2. ⬜ Configure repository secrets
3. ⬜ Set up branch protection rules
4. ⬜ Test first push to trigger workflows
5. ⬜ Review workflow logs in Actions tab
6. ⬜ Configure deployment (if needed)
7. ⬜ Monitor security and coverage reports

## Getting Help

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Workflow Syntax:** https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
- **NestJS Docs:** https://docs.nestjs.com/
- **Community:** Check existing issues or ask in Discussions tab

---

**Status:** ✅ Workflows created  
**Next:** Configure repository secrets and branch protection rules
