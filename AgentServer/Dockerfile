FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
        libsndfile1 \
        libportaudio2 \
        libasound2-dev \
        libffi-dev \
        libssl-dev \
        libpq-dev \
        libpq5 \
        pkg-config \
        git \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# --proxy-headers trusts X-Forwarded-Proto from a reverse proxy (Caddy in
# prod) so redirects Starlette generates (e.g. trailing-slash redirects)
# come back as https:// instead of the plain-http scheme uvicorn sees on
# its own connection — otherwise browsers block them as mixed content.
# --forwarded-allow-ips=* is safe here: this port is published to the
# host's loopback only (127.0.0.1:8000, see docker-compose.prod.yml),
# never reachable directly from outside the host, and the docker bridge
# masks the proxy's real source IP anyway so a fixed allow-list won't
# reliably match it.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
