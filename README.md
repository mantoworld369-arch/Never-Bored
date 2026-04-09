# never bored

Bilingual (English + Traditional Chinese) random topic discovery app. Generates fresh topics via Claude AI on demand — fetches the next batch of 20 in the background whenever you've seen 10 topics.

## Stack

- **Backend**: Node.js + Express
- **AI**: Anthropic Claude (claude-opus-4-5)
- **Frontend**: Vanilla HTML/CSS/JS (no framework)

## Local development

```bash
npm install
cp .env.example .env
# add your ANTHROPIC_API_KEY to .env
npm start
# open http://localhost:3000
```

## Deploy to Railway (recommended — free tier available)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Go to **Variables** tab → add `ANTHROPIC_API_KEY`
5. Railway auto-detects Node.js and deploys — your URL appears in Settings

## Deploy to Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Set **Build command**: `npm install`
5. Set **Start command**: `npm start`
6. Add env variable: `ANTHROPIC_API_KEY`
7. Deploy

## Deploy to Fly.io

```bash
npm install -g flyctl
fly auth login
fly launch        # follow prompts
fly secrets set ANTHROPIC_API_KEY=your_key_here
fly deploy
```

## How topic batching works

- On app start → fetches first 20 topics
- Every 10 topics viewed → pre-fetches next 20 in background
- When queue drops below 10 → triggers another background fetch
- Disliked topics are excluded from all future API requests
- Last 80 seen titles sent to API to prevent repeats
