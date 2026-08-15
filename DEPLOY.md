# Deploying to AWS Lightsail

## Which instance

This app runs a Node server (the admin and the API routes are server-rendered),
so it needs a real instance — not static hosting. Supabase is external, so the
server carries no database.

| Plan | Verdict |
|---|---|
| 512 MB | No. The Node process plus image optimisation will not fit. |
| 1 GB / 2 vCPU | Runs, but only if you build elsewhere. No headroom. |
| **2 GB / 2 vCPU** | **Start here.** Comfortable to run; can build on-server with swap. |
| 4 GB / 2 vCPU | Move here once ads are running steadily. |
| 8 GB | Overkill for this workload. |

**Pick 2 GB / 2 vCPU.** Verify current pricing on the Lightsail console — the
plans get renamed and repriced periodically.

Why 2 GB and not 1 GB: the Next.js build peaks well above 1 GB. The *running*
server only uses ~200 MB, so 1 GB technically serves fine — but you would never
be able to build on the box, and you would have no room for the AVIF encoder
under concurrent traffic. The 2 GB step is cheap insurance.

**Region: Paris (`eu-west-3`).** Lightsail has no African region, and Paris is
the closest to Morocco (~30–50 ms). Do not pick a US region — you would add
~120 ms to every request for Moroccan buyers.

**Blueprint: Ubuntu 22.04 or 24.04 LTS**, "OS Only" (not the Node.js blueprint —
it ships an outdated Node and a bitnami layout that fights systemd).

### Is Lightsail the right choice?

Honestly: for a Next.js app, Vercel is less work — no TLS, no systemd, no nginx,
and image optimisation and CDN are built in. The free tier would likely carry
this landing page.

Lightsail wins on **predictable fixed cost** and full control, which matters if
you are scaling ad spend and do not want usage-based billing surprises. Both are
fine. This guide assumes Lightsail because that is what you asked for.

---

## Two important things about this app before you start

**1. `NEXT_PUBLIC_*` variables are baked in at build time.** They are compiled
into the JavaScript, not read at runtime. So `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_META_PIXEL_ID` and `NEXT_PUBLIC_TIKTOK_PIXEL_ID` must be correct
**before** you build. Changing them later means rebuilding and redeploying.

> Your `.env.local` currently has `NEXT_PUBLIC_SITE_URL=https://your-domain.com`.
> Set it to your real domain before the first build, or canonical URLs, Open
> Graph tags and the sitemap will all point at a placeholder.

**2. The landing page is prerendered at build time**, and its price comes from
Supabase during the build. So the machine that builds needs the Supabase
variables too. Price changes made later in `/admin/products` still appear
immediately — `revalidatePath('/')` regenerates the page on the running server.

---

## Server setup (once)

SSH in from the Lightsail console, then:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx curl git
```

Node 22 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

Swap — important on 2 GB, essential on 1 GB:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Directories:

```bash
sudo mkdir -p /var/www/cahier-eps/releases /etc/cahier-eps
sudo chown -R www-data:www-data /var/www/cahier-eps
```

Secrets — root-owned, readable only by the service:

```bash
sudo nano /etc/cahier-eps/env     # paste your .env.local contents, no quotes
sudo chown root:www-data /etc/cahier-eps/env
sudo chmod 640 /etc/cahier-eps/env
```

> `SUPABASE_SERVICE_ROLE_KEY` bypasses every Row Level Security policy. It
> belongs in this file and nowhere else — never in the repo, never in a
> `NEXT_PUBLIC_` variable.

Service:

```bash
sudo cp deploy/cahier-eps.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cahier-eps
```

Nginx (edit the domain first):

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/cahier-eps
sudo nano /etc/nginx/sites-available/cahier-eps    # replace your-domain.com
sudo ln -s /etc/nginx/sites-available/cahier-eps /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
```

### Networking

In the Lightsail console:

1. **Attach a static IP** (free while attached; you are charged if you reserve
   one and leave it unattached).
2. **Firewall** — allow only 22 (SSH), 80 (HTTP), 443 (HTTPS). Port 3000 must
   **not** be open; nginx reaches Node over loopback.
3. **DNS** — point an A record at the static IP. Lightsail has a free DNS zone,
   or use your registrar.

TLS, once DNS resolves:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot installs a renewal timer automatically.

---

## Deploying

Build on your machine, ship the output. This keeps the server small and means a
broken build never reaches production.

**Locally:**

```bash
./deploy/build-release.sh
scp release.tar.gz ubuntu@YOUR_STATIC_IP:/tmp/
```

The script runs typecheck and tests first, builds, then packs the standalone
output together with `.next/static` and `public` — roughly a 54 MB tarball.

**On the server:**

```bash
sudo /var/www/cahier-eps/current/deploy/install-release.sh /tmp/release.tar.gz
```

For the very first deploy, copy `install-release.sh` up separately since
`current` does not exist yet:

```bash
scp deploy/install-release.sh ubuntu@YOUR_STATIC_IP:/tmp/
ssh ubuntu@YOUR_STATIC_IP 'chmod +x /tmp/install-release.sh && sudo /tmp/install-release.sh /tmp/release.tar.gz'
sudo systemctl reload nginx
```

Each release unpacks into its own timestamped directory and `current` is
switched by swapping a symlink, so there is no moment where the site serves
half-copied files. The script health-checks the new release and prints rollback
instructions if it fails.

### Rollback

```bash
ls -1dt /var/www/cahier-eps/releases/*/ | sed -n 2p          # previous release
sudo ln -sfn <that-path> /var/www/cahier-eps/current
sudo systemctl restart cahier-eps
```

### Building on the server instead

Possible on 2 GB with swap, but slower and it puts your source and Supabase
credentials on the box. If you want it:

```bash
git clone <your-repo> /var/www/cahier-eps/src && cd $_
cp /etc/cahier-eps/env .env.local
npm ci && npm run build
```

Then assemble the release directory as `build-release.sh` does.

---

## After deploying

```bash
sudo systemctl status cahier-eps
sudo journalctl -u cahier-eps -f
curl -I https://your-domain.com
```

Check that:

- the landing page loads and shows the correct price;
- `/admin/login` works and you can sign in;
- a test order submits, then **delete it** from `/admin/orders`;
- `https://your-domain.com/robots.txt` and `/sitemap.xml` show your real domain.

Then set the same domain in Meta and TikTok when you configure the pixels, and
rebuild so the `NEXT_PUBLIC_*` pixel IDs are compiled in.

---

## Operating it

**Backups.** Enable automatic snapshots in the Lightsail console. Your orders
live in Supabase, not on this server, so the snapshot is only protecting the
server config — but it makes rebuilding a one-click job. Supabase has its own
backups; check what your plan includes.

**Monitoring.** `journalctl -u cahier-eps -f` for app logs,
`/var/log/nginx/access.log` for traffic. Lightsail's metrics tab shows CPU and
the burst capacity balance — if CPU sustains above the burst threshold during a
campaign, that is your signal to move to 4 GB.

**Updates.**

```bash
sudo apt update && sudo apt upgrade -y
sudo systemctl restart cahier-eps
```

**What to watch under ad traffic.** The landing page is static HTML served from
memory, so it is cheap. The real CPU cost is AVIF image optimisation, which
happens once per image size per deploy and is then cached for a year. Expect a
brief CPU spike after each deploy, not during normal traffic.
