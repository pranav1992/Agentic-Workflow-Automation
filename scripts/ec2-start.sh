#!/usr/bin/env bash
# Starts the VoiceOrchid EC2 instance and re-points the app at its new
# public IP. There's no Elastic IP on this instance (kept off to avoid
# its cost while stopped), so the IP changes on every start — LIVEKIT_URL
# is both what the api/worker containers use AND what gets handed to the
# browser, VITE_APP_BASE_URL is baked into the client bundle at build
# time, and CORS_ORIGINS must list the new origin or the browser's API
# calls get rejected — all three have to be refreshed every time, and
# the client rebuilt.
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

echo "Re-pointing LIVEKIT_URL / VITE_APP_BASE_URL / CORS_ORIGINS at $PUBLIC_IP and redeploying..."
ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$PUBLIC_IP" "
  set -e
  cd $REMOTE_DIR
  sed -i -E 's|^LIVEKIT_URL=ws://[0-9.]+:7880|LIVEKIT_URL=ws://$PUBLIC_IP:7880|' .env
  sed -i -E 's|^VITE_APP_BASE_URL=http://[0-9.]+:8000|VITE_APP_BASE_URL=http://$PUBLIC_IP:8000|' .env
  sed -i -E 's|^CORS_ORIGINS=.*|CORS_ORIGINS=[\"http://$PUBLIC_IP\"]|' .env
  sudo docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate api worker
  sudo docker compose -f docker-compose.prod.yml --env-file .env build client
  sudo docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate client
"

echo ""
echo "VoiceOrchid is live:"
echo "  UI:      http://$PUBLIC_IP"
echo "  API:     http://$PUBLIC_IP:8000"
echo "  LiveKit: ws://$PUBLIC_IP:7880"
