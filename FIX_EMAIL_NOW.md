# ⚡ Fix Email Node - Quick Guide

## 🎯 Problem
Email node fails with: "EMAIL_USER and EMAIL_PASS environment variables are not set"

## ✅ Solution (2 minutes)

### Step 1: Add Variables in Render

1. Go to: https://dashboard.render.com
2. Click your backend service
3. Click **Environment** (left sidebar)
4. Click **Add Environment Variable**

**Add these EXACTLY:**

```
Key:   EMAIL_USER
Value: aakashleo420@gmail.com
```

```
Key:   EMAIL_PASS
Value: bqjnwuwhdrzyoxis
```

**IMPORTANT:**
- ✅ No quotes around values
- ✅ Case-sensitive: `EMAIL_USER` (not `email_user`)
- ✅ No spaces

### Step 2: Save and Redeploy

1. Click **Save Changes**
2. Render auto-redeploys (2-3 minutes)

### Step 3: Verify in Logs

Check Render logs for:
```
🔍 Environment Variables Status:
   EMAIL_USER: ✅ SET
   EMAIL_PASS: ✅ SET
```

## 🧪 Test

1. Create workflow with Email node
2. Run workflow
3. Check logs for: `✅ Email sent`

## 🐛 Still Not Working?

**Check logs for:**
```
EMAIL_USER: ❌ MISSING
```

**If still missing:**
1. Verify variable names are EXACTLY: `EMAIL_USER` and `EMAIL_PASS`
2. No quotes: `value` not `"value"`
3. Manual redeploy from Render dashboard

**See:** `EMAIL_ENV_FIX.md` for detailed troubleshooting

---

## 🔍 Debug Logging Added

I've added comprehensive logging to help diagnose:

**On startup:**
- Shows which environment variables are set/missing
- Lists all EMAIL_* variables

**On email send:**
- Shows if credentials are present
- Shows credential lengths (without exposing values)
- Lists available EMAIL_* variables

**This will help identify the exact issue in Render logs.**

---

## 📝 Commit and Deploy

After adding variables in Render, optionally commit the debug logging:

```bash
git add backend/main.py backend/workflow_engine.py
git commit -m "Add debug logging for email environment variables"
git push origin main
```

Render will redeploy with the new logging.

---

**Email will work after adding these variables in Render!** 📧✅
