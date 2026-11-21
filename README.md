# UGS Game Portal

HTML5/WebGL browser game portal + developer console. Node.js 18+, Express, SQLite.

## Run
    npm install
    cp .env.example .env     # then edit values, and export them (or use your host's env settings)
    JWT_SECRET=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm start
Open http://localhost:3000. Log in at #/dev with ADMIN_EMAIL to reach #/admin.

## Hosting
This needs a Node host (Render, Railway, Fly.io, a VPS). It cannot run on GitHub Pages.
Keep a persistent disk for DB_PATH. Put it behind HTTPS and set NODE_ENV=production.

## Adding your own WebGL game
Host the build on another HTTPS domain, set the game's play_url and status to 'live' in the `games` table,
or submit it through the Developer console and approve it in Admin.

## Ads
Slots are marked `data-slot`. Wire your SDK inside `window.UGSAds` (preroll / midroll / rewarded) in public/app.js,
and allow the ad hosts in the CSP in server.js. Do not enable ads until the network approves your account.
