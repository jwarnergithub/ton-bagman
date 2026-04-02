# Deployment

This guide explains how to deploy TON Bagman onto a system where TON Storage is already installed and running.

It assumes:

- `storage-daemon` is already running
- `storage-daemon-cli` already works
- you already have SSH access to the VPS
- you want TON Bagman to talk to that VPS over SSH

## What the app expects

TON Bagman does not install TON Storage for you.

It expects an existing TON Storage setup with:

- a working daemon control port, usually `127.0.0.1:5555`
- working CLI keys for `storage-daemon-cli`
- remote folders for uploads and bag sources

At minimum, the app needs to be able to:

- SSH into the VPS
- run `storage-daemon-cli`
- read the CLI key files it is configured to use
- read and write the remote folders used for uploads and bag sources

## Recommended remote folders

These are the folders the app works well with:

- `/opt/ton-storage/uploads`
- `/opt/ton-storage/bag-sources`
- `/opt/ton-storage/test-output`

If they do not exist yet, create them on the VPS.

## Make sure the app can use the daemon CLI keys

The app user must be able to use:

- the daemon CLI client key
- the daemon server public key

If the default daemon key files are root-only, create app-readable copies in a separate folder such as:

- `/opt/ton-storage/app-cli-keys/client`
- `/opt/ton-storage/app-cli-keys/server.pub`

Then point the app at those copied paths in `.env.local`.

## Step 1: get the code onto the machine

Clone the repo:

```bash
git clone <your-private-repo-url>
cd ton-bagman
```

Install dependencies:

```bash
npm install
```

## Step 2: create the environment file

Start from:

```bash
cp .env.example .env.local
```

Then set the values for your setup.

### Example `.env.local`

This example assumes:

- the app runs on the same VPS as TON Storage
- SSH uses a local user on that same machine
- the app talks to TON Storage over SSH even though it is on the same host

```env
NODE_ENV=production

TON_SSH_HOST=127.0.0.1
TON_SSH_PORT=22
TON_SSH_USER=your-ssh-user
TON_SSH_AUTH_MODE=key_path
TON_SSH_PRIVATE_KEY_PATH=/home/your-ssh-user/.ssh/id_ed25519
TON_SSH_KNOWN_HOSTS_PATH=/home/your-ssh-user/.ssh/known_hosts

TON_DAEMON_CONTROL_ADDRESS=127.0.0.1:5555
TON_DAEMON_CLI_KEY_PATH=/opt/ton-storage/app-cli-keys/client
TON_DAEMON_SERVER_PUB_PATH=/opt/ton-storage/app-cli-keys/server.pub

TON_REMOTE_BASE_DIR=/opt/ton-storage/uploads
TON_REMOTE_BAG_SOURCE_DIR=/opt/ton-storage/bag-sources
TON_REMOTE_DELETE_ALLOWED_DIRS=/opt/ton-storage/uploads

TON_LOCAL_STAGING_DIR=staging

TONAPI_BASE_URL=https://tonapi.io
TONAPI_API_KEY=your-tonapi-key
```

If the app runs on a different machine, then:

- `TON_SSH_HOST` should be the VPS hostname or public IP
- `TON_SSH_PRIVATE_KEY_PATH` should point to the app host’s local SSH key
- `TON_SSH_KNOWN_HOSTS_PATH` should point to the app host’s local known-hosts file

## Step 3: confirm SSH works

Before starting the app, make sure the configured SSH user can connect and run the TON CLI command path you expect.

At a minimum, verify:

- SSH login works
- `storage-daemon-cli` works
- the configured CLI key paths are readable

## Step 4: build the app

```bash
npm run build
```

## Step 5: start the app

For a simple first deployment:

```bash
npm run start
```

That starts the production Next.js server.

If you want the app to stay up after logout or reboot, run it under something like:

- `systemd`
- `pm2`
- Docker

## Step 6: verify the app

After the app is running, test these in order:

1. open the app
2. open `/api/health`
3. run the connection test from the Safety page
4. check the bag list
5. open a bag detail page
6. check the Providers page
7. open My Provider

If those work, the app is connected correctly.

## If you do not have a provider yet

That is fine.

The app does not require a provider to be set up before deployment.

You can deploy the app first and use:

- bag management
- bag creation
- provider browsing
- contract preparation

Then later use `My Provider` to set up your own provider.

## Common problems

### The app cannot connect over SSH

Check:

- `TON_SSH_HOST`
- `TON_SSH_PORT`
- `TON_SSH_USER`
- SSH key path or agent setup
- host verification settings

### The app connects, but daemon commands fail

Check:

- `TON_DAEMON_CONTROL_ADDRESS`
- `TON_DAEMON_CLI_KEY_PATH`
- `TON_DAEMON_SERVER_PUB_PATH`
- whether those files are readable by the app user

### The app cannot create or move files remotely

Check:

- `TON_REMOTE_BASE_DIR`
- `TON_REMOTE_BAG_SOURCE_DIR`
- remote directory permissions

### Provider features do not work

Check:

- `TONAPI_API_KEY`
- whether TonAPI is reachable
- whether the daemon can reach a healthy liteserver setup

## Updating the deployment

When you make local changes and push them to GitHub:

```bash
git pull origin main
npm install
npm run build
```

Then restart your app process if needed.
