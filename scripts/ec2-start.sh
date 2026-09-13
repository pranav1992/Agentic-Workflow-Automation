#!/usr/bin/env bash
# Starts the VoiceOrchid EC2 instance and (re)deploys the app.
#
# The instance has an Elastic IP (see scripts/provision.sh), so its
# public IP — and everything derived from it below — is now permanent
# across stops/starts. This script still recomputes and rewrites those
# values every run rather than assuming they're already right; that
# makes it a safe no-op to re-run for a normal redeploy, and it still
# self-heals correctly in the rare case the Elastic IP ever changes
# (re-associated, deallocated and recreated, moved to a new instance).
#
# The app is served over HTTPS via Caddy on <role>.<dashed-ip>.sslip.io
# hostnames (sslip.io resolves any subdomain of a dashed IP to that IP,
# so this needs no purchased domain) — browsers only allow microphone
# access on a secure context, so plain http://<ip> can't work. LIVEKIT_URL,
# VITE_APP_BASE_URL, CORS_ORIGINS, and Caddy's own APP_HOST/API_HOST/
# LIVEKIT_HOST all get (re)written and the client + Caddy recreated
# (Caddy re-issues Let's Encrypt certs for the hostnames automatically).
set -euo pipefail

REGION="${REGION:-ap-south-1}"
INSTANCE_ID="${INSTANCE_ID:-i-0b74da3b226d96b1d}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/voiceorchid-prod.pem}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-voiceorchid}"
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5)

STATE=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].State.Name" --output text)

if [ "$STATE" != "stopped" ] && [ "$STATE" != "running" ]; then
  echo "Instance is in state '$STATE' — expected 'stopped' or 'running'. Aborting." >&2
  exit 1
fi

if [ "$STATE" = "stopped" ]; then
  echo "Starting instance $INSTANCE_ID (region $REGION)..."
  aws ec2 start-instances --region "$REGION" --instance-ids "$INSTANCE_ID" >/dev/null
  aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"
else
  echo "Instance $INSTANCE_ID is already running."
fi

PUBLIC_IP=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text)
echo "Public IP: $PUBLIC_IP"

DASHED_IP="${PUBLIC_IP//./-}"
APP_HOST="app.${DASHED_IP}.sslip.io"
API_HOST="api.${DASHED_IP}.sslip.io"
LIVEKIT_HOST="lk.${DASHED_IP}.sslip.io"

echo "Waiting for SSH + Docker to come up..."
ready=false
for i in $(seq 1 20); do
  if ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$PUBLIC_IP" "sudo docker ps >/dev/null 2>&1" 2>/dev/null; then
    ready=true
    break
  fi
  sleep 10
done
if [ "$ready" != true ]; then
  echo "Timed out waiting for the instance to become reachable." >&2
  exit 1
fi

echo "Re-pointing at $APP_HOST / $API_HOST / $LIVEKIT_HOST and redeploying..."
ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$PUBLIC_IP" "
  set -e
  cd $REMOTE_DIR

  upsert_env() {
    key=\"\$1\"; value=\"\$2\"
    if grep -q \"^\${key}=\" .env; then
      sed -i \"s|^\${key}=.*|\${key}=\${value}|\" .env
    else
      echo \"\${key}=\${value}\" >> .env
    fi
  }

  upsert_env APP_HOST '$APP_HOST'
  upsert_env API_HOST '$API_HOST'
  upsert_env LIVEKIT_HOST '$LIVEKIT_HOST'
  upsert_env LIVEKIT_URL 'wss://$LIVEKIT_HOST'
  upsert_env VITE_APP_BASE_URL 'https://$API_HOST'
  upsert_env CORS_ORIGINS '[\"https://$APP_HOST\"]'

  sudo docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate api worker
  sudo docker compose -f docker-compose.prod.yml --env-file .env build client
  sudo docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate client caddy
"

echo ""
echo "Waiting for Caddy to obtain TLS certificates (first request per host can take ~10-20s)..."
sleep 15

echo ""
echo "VoiceOrchid is live:"
echo "  UI:      https://$APP_HOST"
echo "  API:     https://$API_HOST"
echo "  LiveKit: wss://$LIVEKIT_HOST"
