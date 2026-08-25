# BNC Classes — app

Separate project from the marketing website. The website in the parent folder
is finished and is not touched by any of this.

## Where things stand

`supabase/01_schema.sql` — tables
`supabase/02_policies.sql` — row level security

Run them in that order in the Supabase SQL editor.

## Scope agreed for v1

In:

- Google login
- Student profiles with a readable code (BNC-0001)
- Admin roles, controlled by you, not self-serve
- Courses for grades 9, 10, 11, 12
- Videos directly inside courses, grouped for display by name prefix
  (`Motion - 1`, `Motion - 2`). There is no chapter table; `03_flatten_to_videos.sql`
  removed it
- Manual enrolment by admin
- Protected video playback from Cloudflare R2 via short-lived signed URLs
- Device limit to stop account sharing
- Progress tracking
- Android shell with FLAG_SECURE

Out, by decision:

- Online payments. He collects manually, permanently.
- Automatic enrolment expiry. He manages it manually.
- iOS
- NEET, JEE, KEAM courses
- Any commerce inside the app at all — see below

## Keep commerce out of the app

Google Play's billing rules attach to purchases made inside an app. Because he
collects payment offline and enrols by hand, there is no in-app purchase, so
Play takes no commission.

That holds only while the app contains **no prices, no buy buttons, no links to
payment**. All selling happens on the website or over the phone. Adding a Buy
button later would put the app under Play billing and hand Google a cut.

## Making the first admin

There is no way to become an admin from inside the app, by design. Create the
first one by hand in the Supabase SQL editor after that person has signed in
once:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

After that, admins can promote others from the panel.

## Video pipeline

1. Transcode the backlog locally to 720p. With an NVIDIA GPU this runs 10-20x
   faster than realtime; 400 hours becomes roughly a weekend of unattended
   processing. Do this before uploading, because it cuts upload time by about 4x.
2. Upload through the admin panel. Resumable, because a 2 GB upload on an Indian
   broadband line will drop at least once.
3. Files land in a private R2 bucket. There is no public URL.
4. On play, an Edge Function checks enrolment and returns a signed URL valid for
   about two hours.

## What this does and does not protect

Blocked: downloading, right-click saving, sharing a link, using one account on
many devices.

Blocked in the Android app: screen recording, via FLAG_SECURE. The recording
comes out black.

Not blocked: a camera pointed at the screen, and a rooted phone running a proxy
to intercept the signed URL. Both are accepted trade-offs of skipping paid DRM.

## Running costs

| | |
| --- | --- |
| Cloudflare R2, ~160 GB compressed | about Rs 190 a month |
| Google Play registration | about Rs 2,000, one time |
| Supabase, Cloudflare Pages | free tier |

Cloudflare requires a card on file to enable R2 even inside the free tier.
