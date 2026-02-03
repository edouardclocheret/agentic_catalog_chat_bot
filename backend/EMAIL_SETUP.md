# Email Setup Guide (Gmail + Nodemailer)

## Step 1: Enable 2-Factor Authentication on Gmail

1. Go to https://myaccount.google.com/
2. Click "Security" in the left menu
3. Scroll to "2-Step Verification" and enable it
4. Follow the steps to verify your phone number

## Step 2: Generate Gmail App Password

1. Go to https://myaccount.google.com/apppasswords
2. Select:
   - **App**: Mail
   - **Device**: Windows Computer (or your OS)
3. Google will generate a 16-character password
4. Copy this password

## Step 3: Configure .env File

Update `.env` in the `backend/` directory:

```
EMAIL_USER=your-actual-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

**Important:** 
- Use your full Gmail address for `EMAIL_USER`
- Use the 16-character app password (without spaces if any)
- Do NOT use your regular Gmail password

## Step 4: Test the Setup

Once configured, when a user asks to email their conversation summary:

1. User: "Save this to my email"
2. Agent: "What's your email address?"
3. User: "user@example.com"
4. Agent calls email tool and sends the summary

## Troubleshooting

### "Less secure app access" error
- This shouldn't happen if you're using an app password
- Make sure you generated it from https://myaccount.google.com/apppasswords

### Email not being sent
- Check that `EMAIL_USER` and `EMAIL_PASSWORD` are set correctly in `.env`
- Check backend logs for error messages
- Verify 2-Factor Authentication is enabled

### "Invalid credentials" error
- Double-check your Gmail address and app password
- Make sure there are no extra spaces
- Generate a new app password if needed

## Production Considerations

For production deployment:
- Use environment variables on your hosting platform (Heroku, AWS, etc.)
- Consider using SendGrid or AWS SES for better reliability
- Add rate limiting to prevent email spam
- Store user email preferences securely

