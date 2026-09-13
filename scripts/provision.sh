#!/usr/bin/env bash
# Provisions every AWS resource VoiceOrchid's production host needs, from
# nothing: security group, SSH key pair, EC2 instance, and an Elastic IP.
# Safe to re-run — every step first checks whether its resource already
# exists (by Name tag) and reuses it instead of creating a duplicate, so
# running this against the current setup is a no-op status check, and
# running it against a blank AWS account builds the whole thing.
#
# This replaces doing each of these steps by hand in the AWS console.
# What it does NOT do: install Docker or deploy the app onto the instance
# — see the "Next steps" it prints at the end for that (scripts/ec2-start.sh
# handles pointing the app at the instance once it's up).
set -euo pipefail

REGION="${REGION:-ap-south-1}"
PROJECT_NAME="${PROJECT_NAME:-voiceorchid}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"
VOLUME_SIZE_GB="${VOLUME_SIZE_GB:-30}"
KEY_NAME="${KEY_NAME:-${PROJECT_NAME}-prod}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/${KEY_NAME}.pem}"
# CIDR allowed to SSH in. Defaults to whoever is running this script right
# now — matches the existing sg rule's intent (admin-only SSH), but only
# used when the security group doesn't already exist; an existing group's
# rules are left alone (use `aws ec2 authorize-security-group-ingress`
# by hand to add another admin IP later).
SSH_ADMIN_CIDR="${SSH_ADMIN_CIDR:-}"

INSTANCE_NAME="${PROJECT_NAME}-prod"
SG_NAME="${PROJECT_NAME}-prod-sg"
EIP_NAME="${PROJECT_NAME}-prod"

echo "== VoiceOrchid infra provisioning (region: $REGION) =="

# ── VPC / subnet: use the account's default, same as the existing setup ──
VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" \
  --filters "Name=is-default,Values=true" \
  --query "Vpcs[0].VpcId" --output text)
if [ "$VPC_ID" = "None" ]; then
  echo "No default VPC in $REGION — create one or set up a VPC by hand first." >&2
  exit 1
fi
SUBNET_ID=$(aws ec2 describe-subnets --region "$REGION" \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=default-for-az,Values=true" \
  --query "Subnets[0].SubnetId" --output text)
echo "VPC: $VPC_ID / Subnet: $SUBNET_ID"

# ── Security group ──────────────────────────────────────────────────────
SG_ID=$(aws ec2 describe-security-groups --region "$REGION" \
  --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  if [ -z "$SSH_ADMIN_CIDR" ]; then
    MY_IP=$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')
    SSH_ADMIN_CIDR="${MY_IP}/32"
    echo "SSH_ADMIN_CIDR not set — defaulting to this machine's IP: $SSH_ADMIN_CIDR"
  fi
  echo "Creating security group $SG_NAME..."
  SG_ID=$(aws ec2 create-security-group --region "$REGION" \
    --group-name "$SG_NAME" --description "VoiceOrchid production host" \
    --vpc-id "$VPC_ID" --query "GroupId" --output text)

  aws ec2 create-tags --region "$REGION" --resources "$SG_ID" \
    --tags "Key=Name,Value=$SG_NAME" >/dev/null

  # Mirrors the rules the app actually needs: SSH (admin only), HTTP/HTTPS
  # (Caddy), the plain API port (used for the loopback health check but
  # also reachable directly — see docker-compose.prod.yml comment on the
  # api service's port binding), and LiveKit's signaling + TURN + media
  # ranges (see livekit/livekit.prod.yaml).
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --ip-permissions \
    "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$SSH_ADMIN_CIDR,Description=ssh-admin}]" \
    "IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0,Description=http}]" \
    "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description=https}]" \
    "IpProtocol=tcp,FromPort=8000,ToPort=8000,IpRanges=[{CidrIp=0.0.0.0/0,Description=api}]" \
    "IpProtocol=tcp,FromPort=7880,ToPort=7881,IpRanges=[{CidrIp=0.0.0.0/0,Description=livekit-signal-rtc}]" \
    "IpProtocol=udp,FromPort=3478,ToPort=3478,IpRanges=[{CidrIp=0.0.0.0/0,Description=livekit-turn}]" \
    "IpProtocol=udp,FromPort=50000,ToPort=60000,IpRanges=[{CidrIp=0.0.0.0/0,Description=livekit-media}]" \
    >/dev/null
  echo "Security group created: $SG_ID"
else
  echo "Security group exists: $SG_ID (reusing as-is — rules not modified)"
fi

# ── Key pair ─────────────────────────────────────────────────────────────
if aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" >/dev/null 2>&1; then
  echo "Key pair exists: $KEY_NAME"
  if [ ! -f "$SSH_KEY" ]; then
    echo "  Warning: AWS has this key pair, but $SSH_KEY isn't present locally." >&2
    echo "  You won't be able to SSH in unless you have the original .pem." >&2
  fi
else
  echo "Creating key pair $KEY_NAME..."
  mkdir -p "$(dirname "$SSH_KEY")"
  aws ec2 create-key-pair --region "$REGION" --key-name "$KEY_NAME" \
    --query "KeyMaterial" --output text > "$SSH_KEY"
  chmod 400 "$SSH_KEY"
  echo "Private key saved to $SSH_KEY — back this up, AWS won't show it again."
fi

# ── EC2 instance ─────────────────────────────────────────────────────────
INSTANCE_ID=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=$INSTANCE_NAME" \
            "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query "Reservations[0].Instances[0].InstanceId" --output text 2>/dev/null || echo "None")

if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
  echo "Looking up latest Ubuntu 24.04 LTS AMI..."
  AMI_ID=$(aws ssm get-parameter --region "$REGION" \
    --name "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id" \
    --query "Parameter.Value" --output text)
  echo "AMI: $AMI_ID"

  echo "Launching instance $INSTANCE_NAME..."
  INSTANCE_ID=$(aws ec2 run-instances --region "$REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --subnet-id "$SUBNET_ID" \
    --security-group-ids "$SG_ID" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":$VOLUME_SIZE_GB,\"VolumeType\":\"gp3\",\"DeleteOnTermination\":true}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
    --query "Instances[0].InstanceId" --output text)

  echo "Waiting for instance to be running..."
  aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"
  echo "Instance launched: $INSTANCE_ID"
else
  STATE=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
    --query "Reservations[0].Instances[0].State.Name" --output text)
  echo "Instance exists: $INSTANCE_ID (state: $STATE)"
  if [ "$STATE" = "stopped" ]; then
    echo "Starting it..."
    aws ec2 start-instances --region "$REGION" --instance-ids "$INSTANCE_ID" >/dev/null
    aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"
  fi
fi

# ── Elastic IP ───────────────────────────────────────────────────────────
# Attaching this is the whole point: without it the instance's public IP
# (and every hostname derived from it) changes on every stop/start.
EIP_ALLOC_ID=$(aws ec2 describe-addresses --region "$REGION" \
  --filters "Name=tag:Name,Values=$EIP_NAME" \
  --query "Addresses[0].AllocationId" --output text 2>/dev/null || echo "None")

if [ "$EIP_ALLOC_ID" = "None" ] || [ -z "$EIP_ALLOC_ID" ]; then
  echo "Allocating Elastic IP..."
  EIP_ALLOC_ID=$(aws ec2 allocate-address --region "$REGION" --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$EIP_NAME}]" \
    --query "AllocationId" --output text)
fi

CURRENT_ASSOC_INSTANCE=$(aws ec2 describe-addresses --region "$REGION" \
  --allocation-ids "$EIP_ALLOC_ID" \
  --query "Addresses[0].InstanceId" --output text 2>/dev/null || echo "None")

if [ "$CURRENT_ASSOC_INSTANCE" != "$INSTANCE_ID" ]; then
  echo "Associating Elastic IP with $INSTANCE_ID..."
  aws ec2 associate-address --region "$REGION" \
    --instance-id "$INSTANCE_ID" --allocation-id "$EIP_ALLOC_ID" >/dev/null
else
  echo "Elastic IP already associated with $INSTANCE_ID"
fi

PUBLIC_IP=$(aws ec2 describe-addresses --region "$REGION" --allocation-ids "$EIP_ALLOC_ID" \
  --query "Addresses[0].PublicIp" --output text)
DASHED_IP="${PUBLIC_IP//./-}"

echo ""
echo "== Done =="
echo "Instance:    $INSTANCE_ID"
echo "Elastic IP:  $PUBLIC_IP  (permanent — survives stop/start now)"
echo "SSH:         ssh -i $SSH_KEY ubuntu@$PUBLIC_IP"
echo "App URL:     https://app.${DASHED_IP}.sslip.io  (once deployed)"
echo ""
echo "Next steps (one-time, if this instance is new):"
echo "  1. SSH in, install Docker + the compose plugin, clone the repo into ~/voiceorchid."
echo "  2. Copy .env / secrets onto the host (not tracked in git)."
echo "  3. Run: APP_HOST=app.${DASHED_IP}.sslip.io API_HOST=api.${DASHED_IP}.sslip.io \\"
echo "          LIVEKIT_HOST=lk.${DASHED_IP}.sslip.io scripts/ec2-start.sh"
echo "  Existing deployments: just re-run scripts/ec2-start.sh to redeploy —"
echo "  since the IP no longer changes, its hostname re-derivation is now a no-op."
