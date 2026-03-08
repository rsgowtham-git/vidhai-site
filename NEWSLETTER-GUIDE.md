# 📧 Vidhai Newsletter Automation Guide

## Overview

Your Vidhai blog now has a fully automated newsletter system that:

- ✅ **Auto-generates** beautiful newsletters from your latest blog posts
- ✅ **Shows you a preview** before sending
- ✅ **Requires your approval** before any emails go out
- ✅ **Sends to all subscribers** with personalized unsubscribe links
- ✅ **Tracks sends** in your Supabase database
- ✅ **Optional automation** for weekly/monthly scheduled sends

---

## Quick Start - Manual Send (Recommended)

### Step 1: Access Admin Dashboard

Visit: **https://vidhai.co/admin-newsletter.html**

### Step 2: Generate Draft

1. Select frequency: **Weekly** / **Monthly** / **Special Edition**
2. Click **"⚡ Generate Draft"**
3. System automatically:
   - Fetches your latest 3 blog posts
   - Creates beautiful HTML email
   - Shows subscriber count
   - Displays preview

### Step 3: Review Preview

- Check the email preview in the iframe
- Review the subject line
- Verify post summaries look good

### Step 4: Approve & Send

1. Click **"🚀 Approve & Send"**
2. Confirm the send dialog
3. Emails go out to all active subscribers
4. Each subscriber gets personalized unsubscribe link

**That's it!** The whole process takes ~2 minutes.

---

## API Endpoints

### 1. `/api/newsletter-draft` (GET)

Generates newsletter draft from latest posts.

**Query Parameters:**
- `frequency` (optional): `weekly` | `monthly` | `special` (default: `weekly`)

**Example:**
```bash
curl https://vidhai.co/api/newsletter-draft?frequency=weekly
```

**Response:**
```json
{
  "success": true,
  "subject": "Vidhai Weekly: AI Insights for March 7, 2026",
  "htmlContent": "<html>...</html>",
  "postCount": 3,
  "subscriberCount": 42,
  "frequency": "weekly",
  "posts": [
    {
      "id": "post-1",
      "title": "Why I Started Vidhai",
      "date": "March 4, 2026",
      "excerpt": "..."
    }
  ]
}
```

### 2. `/api/newsletter-send` (POST)

Sends newsletter to all active subscribers.

**Request Body:**
```json
{
  "subject": "Vidhai Weekly: AI Insights for March 7, 2026",
  "htmlContent": "<html>...</html>",
  "frequency": "weekly"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Newsletter sent to 42 subscribers.",
  "sent": 42,
  "failed": 0
}
```

### 3. `/api/newsletter-schedule` (GET) - Optional

Automated scheduled sends (requires setup).

**Headers:**
- `Authorization: Bearer YOUR_SECRET_TOKEN`

**Query Parameters:**
- `frequency` (optional): `weekly` | `monthly`

---

## Newsletter Content Structure

The auto-generated newsletter includes:

1. **Header Section**
   - Vidhai logo (விதை)
   - "Your AI Intelligence Brief" tagline
   - Current date

2. **Introduction Paragraph**
   - Weekly: "Here's your weekly roundup..."
   - Monthly: "Fresh insights from Vidhai..."

3. **Blog Post Cards** (3 most recent)
   - Post title
   - Date + read time + tags
   - Excerpt
   - "Read Full Article →" button (links to your blog)

4. **Footer CTAs**
   - "Visit Blog" button
   - "Connect on LinkedIn" button

5. **Unsubscribe Footer**
   - Personalized unsubscribe link (different for each recipient)
   - Link to website
   - Copyright notice

---

## Automation Options

### Option A: Manual (Current Setup)

**Best for:** Full control over timing and content

**Process:**
1. Visit admin dashboard when ready to send
2. Generate draft
3. Review and approve

**Pros:**
- ✅ Complete control
- ✅ Review every newsletter
- ✅ Send only when you have new content

**Cons:**
- ❌ Requires manual action

---

### Option B: Scheduled Automation

**Best for:** Set-it-and-forget-it weekly newsletters

#### Setup with GitHub Actions

Create `.github/workflows/newsletter.yml`:

```yaml
name: Weekly Newsletter

on:
  schedule:
    # Every Monday at 9 AM PST (17:00 UTC)
    - cron: '0 17 * * 1'
  workflow_dispatch: # Allow manual trigger

jobs:
  send-newsletter:
    runs-on: ubuntu-latest
    steps:
      - name: Send Newsletter
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.NEWSLETTER_SECRET }}" \
            https://vidhai.co/api/newsletter-schedule?frequency=weekly
```

**Required Secrets:**
1. Go to GitHub repo Settings → Secrets and variables → Actions
2. Add `NEWSLETTER_SECRET` (generate random token)
3. Add same token to Vercel env vars as `NEWSLETTER_SCHEDULE_SECRET`

#### Setup with Vercel Cron

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/newsletter-schedule?frequency=weekly",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

**Note:** Vercel Cron requires Pro plan.

---

## Environment Variables

Required in Vercel:

- `SUPABASE_URL` - Your Supabase project URL (already set)
- `SUPABASE_KEY` - Your Supabase anon key (already set)
- `RESEND_API_KEY` - Your Resend API key (already set)
- `NEWSLETTER_SCHEDULE_SECRET` - Secret token for automation (only needed if using automation)

---

## Customization

### Change Number of Posts

Edit `api/newsletter-draft.js`, line 148:

```javascript
// Change from 3 to 5 posts
posts = allPosts.slice(0, 5);
```

### Change Email Styling

Edit the `generateNewsletterHTML()` function in:
- `api/newsletter-draft.js` (for manual sends)
- `api/newsletter-schedule.js` (for automated sends)

All styles are inline for email compatibility.

### Change Send Day (Automation)

Edit `api/newsletter-schedule.js`, line 176:

```javascript
// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
if (frequency === 'weekly' && dayOfWeek !== 1) {
```

### Custom Subject Lines

Edit subject generation in `api/newsletter-draft.js`, line 171:

```javascript
const subject = frequency === 'weekly' 
  ? `Vidhai Weekly: AI Insights for ${subjectDate}`
  : `Vidhai Update: ${posts[0].title}`;
```

---

## Subscriber Management

### View Subscribers

Visit your Supabase dashboard:
- Table: `subscribers`
- Filter: `status = active`

### Export Subscriber List

```bash
curl https://vidhai.co/api/subscribers?action=list
```

### Unsubscribe Handling

Automatic! Each email includes personalized unsubscribe link:
```
https://vidhai.co/api/subscribers?action=unsubscribe&email=user@example.com
```

One click unsubscribes and shows confirmation.

---

## Tracking & Analytics

### Newsletter Sends Table

Every send is logged in Supabase `newsletter_sends` table:

- `subject` - Email subject
- `recipient_count` - How many emails sent
- `status` - `sent` | `partial` | `failed`
- `created_at` - When sent

### View Send History

Query Supabase:

```sql
SELECT 
  subject,
  recipient_count,
  status,
  created_at
FROM newsletter_sends
ORDER BY created_at DESC;
```

---

## Troubleshooting

### "No posts found"

**Cause:** Can't fetch posts from Supabase or posts.json

**Solution:**
1. Check `posts.json` exists in repo
2. Verify Supabase `posts` table (optional)
3. Check GitHub repo is public or has correct access

### "Resend API key not configured"

**Cause:** Missing `RESEND_API_KEY` in Vercel env vars

**Solution:**
1. Go to Vercel project settings
2. Environment Variables
3. Add `RESEND_API_KEY` with your Resend key
4. Redeploy

### "No active subscribers"

**Cause:** No subscribers in database or all unsubscribed

**Solution:**
1. Check Supabase `subscribers` table
2. Verify `status = 'active'`
3. Test by adding yourself:

```bash
curl -X POST https://vidhai.co/api/subscribers \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","frequency":"weekly"}'
```

### Emails not sending

**Checklist:**
1. ☑️ `RESEND_API_KEY` set in Vercel
2. ☑️ Resend domain verified (newsletter@vidhai.co)
3. ☑️ Active subscribers exist
4. ☑️ Check Vercel logs for errors
5. ☑️ Check Resend dashboard for delivery status

---

## Best Practices

### Content

- ✅ Write at least 3 posts before first newsletter
- ✅ Keep post excerpts under 200 characters
- ✅ Use clear, compelling titles
- ✅ Add relevant tags to posts

### Timing

- ✅ **Weekly:** Send on Mondays (best open rates)
- ✅ **Time:** 9-10 AM in subscriber timezone
- ✅ **Consistency:** Same day/time each week

### Frequency

- ✅ Start with weekly or bi-weekly
- ✅ Only send when you have new content
- ✅ Don't send more than once per week

### Testing

- ✅ Always preview before sending
- ✅ Send test to yourself first
- ✅ Check on mobile and desktop
- ✅ Verify all links work

---

## Next Steps

1. **Test the System**
   - Visit https://vidhai.co/admin-newsletter.html
   - Generate a draft
   - Send test to yourself

2. **Collect More Subscribers**
   - Add newsletter signup form to more pages
   - Promote newsletter on LinkedIn
   - Add CTA at end of blog posts

3. **Create Content Calendar**
   - Plan weekly blog posts
   - Schedule newsletter sends
   - Track engagement

4. **Optional: Set Up Automation**
   - Configure GitHub Actions for weekly sends
   - Or keep manual control via admin dashboard

---

## Support

Questions? Issues?

- Check Vercel logs for API errors
- Review Supabase tables for data issues
- Check Resend dashboard for email delivery
- Review this guide for configuration help

Happy newslettering! 🚀
