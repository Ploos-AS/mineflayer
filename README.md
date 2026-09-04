# Mineflayer Container

A small, production-oriented OCI image for running a configurable [Mineflayer](https://github.com/PrismarineJS/mineflayer) Minecraft bot.

This repository packages Mineflayer as a ready-to-run service. It is not a fork of Mineflayer.

## Features

- Mineflayer 4.38.0
- Node.js 24 Alpine runtime
- Multi-architecture image (`linux/amd64`, `linux/arm64`)
- Non-root runtime
- Environment-variable configuration
- Offline and Microsoft authentication modes
- Automatic reconnect with bounded exponential backoff
- Graceful shutdown
- Docker health check
- Persistent `/data` directory for Microsoft authentication tokens and future state
- Docker Compose example
- GitHub Actions CI and GHCR release workflow
- OCI metadata, SBOM and build provenance

## Image

```text
ghcr.io/ploos-as/mineflayer
```

Images are published on version tags. The `latest` tag follows the newest stable version tag.

## Quick start

```bash
cp .env.example .env
$EDITOR .env
docker compose up -d
```

Then follow the logs:

```bash
docker compose logs -f mineflayer
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `MC_HOST` | `minecraft` | Minecraft server hostname or IP |
| `MC_PORT` | `25565` | Minecraft server port |
| `MC_USERNAME` | `MineflayerBot` | Bot username or Microsoft account identity |
| `MC_AUTH` | `offline` | `offline` or `microsoft` |
| `MC_VERSION` | unset | Minecraft version; unset enables auto-detection |
| `MC_PASSWORD` | unset | Legacy password field when required by a compatible auth flow |
| `RECONNECT` | `true` | Reconnect after disconnect/errors |
| `RECONNECT_INITIAL_MS` | `2000` | Initial reconnect delay |
| `RECONNECT_MAX_MS` | `30000` | Maximum reconnect delay |
| `RECONNECT_FACTOR` | `2` | Exponential backoff factor |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `HEALTH_FILE` | `/tmp/mineflayer-healthy` | Internal health marker |

For Microsoft authentication, `/data` is used as the Mineflayer auth cache. On first login, watch the container logs and complete the device-code flow when prompted.

## Docker Compose

```yaml
services:
  mineflayer:
    image: ghcr.io/ploos-as/mineflayer:latest
    restart: unless-stopped
    environment:
      MC_HOST: "192.168.1.50"
      MC_PORT: "25565"
      MC_USERNAME: "MineflayerBot"
      MC_AUTH: "offline"
    volumes:
      - ./data:/data
```

For a Pterodactyl-hosted Minecraft server on the same machine, set `MC_HOST` to an address reachable from this container and `MC_PORT` to the allocation assigned to that server. Do not assume the Pterodactyl container network is directly reachable from unrelated Compose projects.

## Local build

```bash
docker build -t mineflayer:local .
docker run --rm \
  -e MC_HOST=host.docker.internal \
  -e MC_USERNAME=MineflayerBot \
  mineflayer:local
```

On Linux, add an appropriate `--add-host` mapping or use the host/LAN address of the Minecraft server.

## Health

The container reports healthy only while Mineflayer has an active login session. During reconnect backoff the container becomes unhealthy but remains running.

```bash
docker inspect --format '{{json .State.Health}}' mineflayer
```

## Scope

The bundled bot deliberately contains minimal behavior. Version 0.1.x focuses on a reliable runtime/container foundation rather than opinionated gameplay automation. Custom plugins and richer behavior can be layered on later without coupling the base image to one use case.

## Security

The runtime process runs as an unprivileged user. No Docker socket, host networking, privileged mode, or extra Linux capabilities are required.

Keep Microsoft authentication state under `/data` private and do not commit it to source control.

## Upstream

Mineflayer is maintained by the PrismarineJS project and is licensed separately under its upstream license. This repository packages the published npm package and does not vendor upstream source code.

## License

The packaging code in this repository is licensed under the MIT License. See [LICENSE](LICENSE).
