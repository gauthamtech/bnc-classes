# Turning on video

Everything is written. It needs one Cloudflare bucket and two function
deployments, then uploads work from the admin panel.

## 1. Cloudflare R2

1. Sign up at cloudflare.com. **A card is required to enable R2 even on the
   free tier.** At your volume the bill is a few hundred rupees a month.
2. R2 → Create bucket → name it `bnc-videos`. Location: Asia-Pacific.
3. **Leave it private.** Do not enable public access. The whole design assumes
   nobody can reach a file without a URL the server signs.
4. R2 → Manage API Tokens → Create token → **Object Read & Write**, scoped to
   this bucket only. Copy the Access Key ID and Secret Access Key. The secret
   is shown once.
5. Note your Account ID from the R2 overview page.

### CORS

The browser uploads straight to R2, so the bucket must allow it.
Bucket → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5174", "https://your-app-domain"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Without this, uploads fail with a CORS error and nothing else will tell you why.

## 2. Function secrets

Supabase dashboard → Edge Functions → Secrets. Add:

```
R2_ACCOUNT_ID=your-account-id
R2_BUCKET=bnc-videos
R2_ACCESS_KEY_ID=from-step-4
R2_SECRET_ACCESS_KEY=from-step-4
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

**The service role key stays here and only here.** It must never appear in the
web app, in git, or in a chat window.

## 3. Deploy the two functions

Install the CLI once, then from `bnc-app/`:

```bash
npx supabase login
npx supabase link --project-ref kuikafwwkxhmcpokefnf
npx supabase functions deploy play
npx supabase functions deploy sign-upload
```

## 4. Test

Admin → Courses → open a course → **upload video** on any row. Pick a small
file first, not a 2 GB one. You should see a progress bar, then the row flips
to `visible` on its own.

Then open the course as a student and press play.

## How it works

| | |
| --- | --- |
| Upload | Browser asks `sign-upload` for a one-off PUT URL, then sends the file **straight to R2**. It never passes through Supabase, so there is no size limit and no function time burned on a 2 GB file. |
| Playback | Player asks `play` for a URL. The function checks enrolment with the service key and signs a link that dies in 2 hours. |
| Duration | Read in the browser from the file itself, so students see run times with no transcoding. |

The storage key never reaches the browser. A shared link expires. An
unenrolled student gets 403 from the function even if they guess a lesson id.

## Known limit

Uploads are a single PUT. If the connection drops at 80% of a 2 GB file, it
starts again. If that turns out to be common on his line, the upgrade is
multipart upload with resume — a change inside `Uploader.tsx` and
`sign-upload`, not a redesign.

Recording at 1080p 30fps rather than 4K roughly halves the file and the risk.
