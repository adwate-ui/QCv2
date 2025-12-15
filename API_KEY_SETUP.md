# API Key Setup Guide

AuthentiqC uses the Google Gemini API for AI-powered product identification and quality control analysis. You need a Gemini API key to use these features.

## Getting Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Choose a Google Cloud project (or create a new one)
5. Copy your API key (starts with `AIza...`)

## Where to Add Your API Key

You have **three options** for adding your API key:

### Option 1: During Login/Registration (Easiest)

1. When creating an account or logging in, click **"+ Add Gemini API Key (Optional)"**
2. Paste your API key
3. Continue with login/registration
4. Your API key will be saved securely to your profile

### Option 2: In Your Profile (Anytime)

1. Log in to AuthentiqC
2. Click on your profile (top right)
3. Go to **"User Profile"**
4. In the **"Gemini API Configuration"** section, click **"Change"**
5. Paste your API key and click **"Save Key"**

### Option 3: Environment Variable (Development Only)

For local development, you can add it to your `.env.local` file:

```env
GEMINI_API_KEY=your-api-key-here
```

This method is useful during development, but for production, it's better to have users add their own keys via Options 1 or 2.

## Security Notes

- Your API key is stored securely in your Supabase profile
- The key is encrypted in transit and at rest
- Only you can see and use your API key
- You can update or remove your key at any time from your profile
- Never share your API key with others

## API Key Pricing

Google Gemini offers:
- **Free tier:** 15 requests per minute, 1500 requests per day
- **Paid tier:** Higher rate limits

For most personal use, the free tier is sufficient.

## Troubleshooting

### "API key not found" error

**Solution:** Add your API key using Option 1 or 2 above.

### "Invalid API key" error

**Possible causes:**
- The API key was typed incorrectly (check for extra spaces)
- The API key has been revoked or deleted in Google Cloud
- The API key doesn't have permission to use Gemini API

**Solution:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Verify your API key is active
3. Create a new API key if needed
4. Update your key in AuthentiqC

### "Rate limit exceeded" error

**Cause:** You've exceeded the free tier limits (15 requests/minute or 1500/day)

**Solution:**
- Wait a few minutes and try again
- Upgrade to a paid plan in Google Cloud
- Use the app more sparingly

## Multiple API Keys

Currently, AuthentiqC stores one API key per user. If you need to use different keys:
- Update your key in your profile before each session
- Or use multiple AuthentiqC accounts (each with its own API key)

## Revoking an API Key

If you think your API key has been compromised:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your API key in the list
3. Click the delete/revoke button
4. Create a new API key
5. Update your AuthentiqC profile with the new key

## Support

If you continue to have issues with API keys:
- Check the browser console for detailed error messages
- Verify your Google Cloud project has the Gemini API enabled
- Create a GitHub issue in this repository
