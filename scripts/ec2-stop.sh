#!/usr/bin/env bash
# Stops the VoiceOrchid EC2 instance to pause compute billing.
# EBS storage (~$2-3/mo for the 30GB volume) still bills while stopped.
set -euo pipefail

REGION="${REGION:-ap-south-1}"
INSTANCE_ID="${INSTANCE_ID:-i-0b74da3b226d96b1d}"

STATE=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].State.Name" --output text)

if [ "$STATE" = "stopped" ]; then
  echo "Instance $INSTANCE_ID is already stopped."
  exit 0
fi

echo "Stopping instance $INSTANCE_ID (region $REGION)..."
aws ec2 stop-instances --region "$REGION" --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-stopped --region "$REGION" --instance-ids "$INSTANCE_ID"

echo "Instance stopped. Compute billing paused; EBS storage still bills."
echo "Note: the Elastic IP keeps its hostname while stopped, but AWS bills"
echo "a small hourly fee for an EIP that isn't attached to a running instance"
echo "(unlike before, when there was no EIP and no such cost while stopped)."
echo "Run scripts/ec2-start.sh to bring it back up and redeploy."
