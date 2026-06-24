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

## Full Setup Guide (From Zero to Live Deployment)

This section walks through everything needed to reproduce this project from scratch — useful if you're cloning this repo to learn from it, or building your own version.

### Prerequisites

- A GitHub account
- An AWS account (the Free Tier covers everything used here)
- Git, Node.js, and npm installed locally
- A terminal that supports Linux-style commands (Git Bash on Windows, or any terminal on Mac/Linux)

### Step 1 — Launch an AWS EC2 Instance

1. Log into the [AWS Console](https://console.aws.amazon.com) → search **EC2** → click **Instances** → **Launch instance**
2. Configure:
   - **Name:** anything descriptive, e.g. `my-cicd-server`
   - **AMI:** Ubuntu Server 22.04 LTS
   - **Instance type:** `t2.micro` (Free Tier eligible)
   - **Key pair:** create a new one, type RSA, format `.pem` — download and save it somewhere safe
   - **Network settings:** allow SSH (source: *My IP*, not *Anywhere*), allow HTTP and HTTPS
   - Add an additional custom TCP rule: **port 3000**, source **Anywhere** (this is the app's port)
   - **Storage:** default 8 GB is enough
3. Click **Launch instance**
4. Once it shows "Running," copy its **Public IPv4 address** from the instance details — you'll need this later

### Step 2 — Prepare the EC2 Server

Connect to the instance from your terminal:

```bash
ssh -i /path/to/your-key.pem ubuntu@<your-ec2-public-ip>
```

If you get a permissions error, run `chmod 400 /path/to/your-key.pem` first, then retry.

Once connected, install Node.js and Docker on the server:

```bash
sudo apt update && sudo apt upgrade -y

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
```

Log out and back in for the Docker group change to apply:

```bash
exit
ssh -i /path/to/your-key.pem ubuntu@<your-ec2-public-ip>
docker ps
```

`docker ps` should run without needing `sudo` and show an empty table with no errors.

### Step 3 — Create the GitHub Repository

1. On [GitHub](https://github.com), click **+ → New repository**
2. Name it (e.g. `my-cicd-project`), choose Public or Private
3. Leave README/.gitignore/license **unchecked**
4. Click **Create repository** and copy the repo URL shown

### Step 4 — Build the Project Locally

On your local machine, in a terminal:

```bash
mkdir my-cicd-project && cd my-cicd-project
git init
git remote add origin <your-github-repo-url>

mkdir -p src tests .github/workflows
```

Create `src/index.js`:

```bash
cat > src/index.js << 'EOF'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'CI/CD Pipeline is live!', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
EOF
```

Create `tests/app.test.js`:

```bash
cat > tests/app.test.js << 'EOF'
const request = require('supertest');
const app = require('../src/index');

describe('App routes', () => {
  it('GET / should return 200', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
  });

  it('GET /health should return healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});
EOF
```

Initialize npm and install dependencies:

```bash
npm init -y
npm install express
npm install --save-dev jest supertest
```

Edit `package.json` and set the `"scripts"` section to:

```json
"scripts": {
  "start": "node src/index.js",
  "test": "jest"
},
```

Create `.gitignore`:

```bash
cat > .gitignore << 'EOF'
node_modules/
.env
*.log
.DS_Store
EOF
```

Create `Dockerfile`:

```bash
cat > Dockerfile << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
EOF
```

Create `.dockerignore`:

```bash
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.git
.gitignore
.github
README.md
tests
EOF
```

Test everything works locally before going further:

```bash
npm test
npm start
```

Visit `http://localhost:3000` and `http://localhost:3000/health` to confirm both return JSON, then stop the server with `Ctrl+C`.

### Step 5 — Add GitHub Secrets

GitHub Actions needs credentials to SSH into your EC2 instance on your behalf. In your GitHub repo:

**Settings → Secrets and variables → Actions → New repository secret**

Add three secrets:

| Name | Value |
|---|---|
| `EC2_HOST` | Your EC2 instance's public IPv4 address |
| `EC2_USERNAME` | `ubuntu` |
| `EC2_SSH_KEY` | The full contents of your `.pem` file, including the `-----BEGIN` and `-----END` lines (get this by running `cat /path/to/your-key.pem`) |

These are encrypted by GitHub and never visible again after saving — this is the standard, safe way to store deployment credentials.

### Step 6 — Create the Workflow File

```bash
cat > .github/workflows/deploy.yml << 'EOF'
name: CI/CD Pipeline

on:
  push:
    branches: [master]

jobs:
  test:
    name: Test Application
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

  deploy:
    name: Deploy to EC2
    runs-on: ubuntu-latest
    needs: test
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            if [ -d ~/my-cicd-project ]; then
              cd ~/my-cicd-project && git pull origin master
            else
              git clone <your-github-repo-url> ~/my-cicd-project
              cd ~/my-cicd-project
            fi
            docker build -t my-cicd-app .
            docker stop my-cicd-app || true
            docker rm my-cicd-app || true
            docker run -d --name my-cicd-app -p 3000:3000 my-cicd-app
EOF
```

> Replace `<your-github-repo-url>` with your actual repo's HTTPS URL.

### Step 7 — Push and Deploy

```bash
git add .
git commit -m "Initial commit: app, tests, Docker, and CI/CD pipeline"
git push -u origin master
```

This push automatically triggers the workflow. Go to your repo's **Actions** tab on GitHub to watch it run live — it should run the tests, then SSH into EC2, build the Docker image, and start the container.

Once it finishes successfully (green checkmark), visit:

```
http://<your-ec2-public-ip>:3000
```

You should see the app responding live — deployed entirely by the pipeline, with no manual server-side steps.

### Troubleshooting Notes

Two real issues came up while building this and are worth knowing about in advance:

- **`npm ci` failing with lock file sync errors** — happens if `package-lock.json` and `package.json` fall out of sync (e.g. from installing packages in separate steps on different npm versions). Fix: delete `node_modules` and `package-lock.json`, run `npm install` fresh, then commit the regenerated lock file.
- **Test job hanging indefinitely in CI** — caused by `app.listen()` running even when the file is only imported for testing, which keeps the process alive. Fix: wrap `app.listen()` in `if (require.main === module) { ... }` so it only runs when the file is executed directly, not when imported by test files.

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
