# CI/CD Pipeline with GitHub Actions & AWS EC2

A complete, working CI/CD pipeline that automatically tests and deploys a Node.js application to a live AWS EC2 server — triggered entirely by a `git push`, with zero manual deployment steps.

**Live demo:** `http://<your-ec2-ip>:3000`

---

## What This Project Demonstrates

This isn't a toy example — it's a working pipeline that mirrors how real engineering teams ship code:

- **Continuous Integration** — every push automatically runs the test suite before anything is deployed
- **Continuous Deployment** — passing builds are automatically shipped to a live cloud server with no manual intervention
- **Containerization** — the application runs inside Docker, the same way it would in production
- **Infrastructure** — a provisioned AWS EC2 instance with properly scoped security groups (SSH restricted, app port exposed)
- **Secrets management** — SSH credentials are stored securely using GitHub Actions encrypted secrets, never hardcoded
- **Zero-downtime-style redeploys** — the pipeline tears down the old container and starts a fresh one on every successful push

## Architecture

```
Developer pushes to GitHub (main/master)
            │
            ▼
   ┌─────────────────────────┐
   │   GitHub Actions          │
   │                           │
   │  1. Checkout code         │
   │  2. Install dependencies  │
   │  3. Run automated tests   │
   │  4. SSH into EC2          │
   │  5. Pull latest code      │
   │  6. Build Docker image    │
   │  7. Stop old container    │
   │  8. Start new container   │
   └───────────┬───────────────┘
               │
               ▼
   ┌─────────────────────────┐
   │   AWS EC2 (Ubuntu)        │
   │   Docker container        │
   │   running on port 3000    │
   └─────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Application | Node.js, Express |
| Testing | Jest, Supertest |
| Containerization | Docker |
| CI/CD | GitHub Actions |
| Hosting | AWS EC2 (Ubuntu 22.04) |
| Deployment method | SSH-based automated deploy |

## How the Pipeline Works

Every push to `master` triggers `.github/workflows/deploy.yml`, which runs two jobs in sequence:

**1. Test** — installs dependencies and runs the full Jest test suite. If any test fails, the pipeline stops here and nothing gets deployed.

**2. Deploy** — only runs if tests pass. GitHub Actions securely SSHes into the EC2 instance using credentials stored in GitHub Secrets, pulls the latest code, rebuilds the Docker image, and replaces the running container with the new version.

```yaml
on:
  push:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/my-cicd-project && git pull origin master
            docker build -t my-cicd-app .
            docker stop my-cicd-app || true
            docker rm my-cicd-app || true
            docker run -d --name my-cicd-app -p 3000:3000 my-cicd-app
```

## Project Structure

```
my-cicd-project/
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD pipeline definition
├── src/
│   └── index.js            # Express application
├── tests/
│   └── app.test.js         # Automated test suite
├── Dockerfile               # Multi-stage container build
├── .dockerignore
├── .gitignore
└── package.json
```

## Running It Locally

```bash
git clone https://github.com/nnihal7/My-CICD-project.git
cd My-CICD-project
npm install
npm test
npm start
```

Visit `http://localhost:3000`

## API Endpoints

| Endpoint | Method | Response |
|---|---|---|
| `/` | GET | App status and version |
| `/health` | GET | Health check for monitoring |

## Security Considerations

- SSH access to the EC2 instance is restricted to a specific IP, not open to the public internet
- Deployment credentials (SSH private key, host, username) are stored as encrypted GitHub Actions secrets and are never committed to the repository
- The Docker image runs as a non-root user inside the container

## What I Learned

Building this project involved debugging real, practical CI/CD problems — not just following a script:

- Diagnosed and fixed an `npm ci` lock-file sync failure in a clean CI environment
- Identified and resolved a hanging test suite caused by an Express server not exiting cleanly in CI, by isolating `app.listen()` to only run outside of test imports
- Configured AWS EC2 security groups correctly to balance SSH access (restricted) with public app access (port 3000)
- Managed deployment secrets securely using GitHub Actions encrypted secrets rather than hardcoding credentials

## Possible Next Steps

- Add a staging environment with manual approval before production deploys
- Integrate container vulnerability scanning (Trivy) into the pipeline
- Add deployment notifications via Slack/Discord webhook
- Migrate from a single EC2 instance to an auto-scaling setup behind a load balancer

---

**Author:** [nnihal7](https://github.com/nnihal7)
