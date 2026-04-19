# 🔧 Render Environment Variables - Complete Guide

## 🎯 Your Issue

**Error:** "EMAIL_USER and EMAIL_PASS environment variables are not set"

**Backend:** Python/FastAPI (not Node.js)

**Platform:** Render

**Status:** Variables added in Render dashboard but not being read

---

## ✅ Your Code is Correct

Your Python code correctly accesses environment variables:

```python
email_user = os.environ.get("EMAIL_USER", "").strip()
email_pass = os.environ.get("EMAIL_PASS", "").strip()
```

This is the **correct pattern** for Python. The issue is with Render configuration.

---

## 🔍 Most Common Causes

### 1. **Service Not Redeployed After Adding Variables** (90% of cases)

**Problem:**
- You added variables in Render dashboard
- But the service is still running the old deployment
- Old deployment doesn't have the new variables

**Solution:**
```
Render Dashboard → Your Service → Manual Deploy → Deploy latest commit
```

### 2. **Variable Names Don't Match Exactly** (Case-Sensitive)

**Problem:**
- Code expects: `EMAIL_USER`
- Dashboard has: `email_user` or `Email_User`

**Solution:**
- Variable names are **case-sensitive**
- Must be exactly: `EMAIL_USER` and `EMAIL_PASS`

### 3. **Extra Spaces or Quotes in Values**

**Problem:**
- Dashboard value: `"aakashleo420@gmail.com"` (with quotes)
- Or: `EMAIL_USER = value` (with spaces)

**Solution:**
- No quotes: `aakashleo420@gmail.com`
- No spaces: `EMAIL_USER=value`

### 4. **Variables Added to Wrong Service**

**Problem:**
- You have multiple services on Render
- Added variables to wrong service

**Solution:**
- Verify you're in the correct service
- Check service name matches your backend

### 5. **Variables Not Saved**

**Problem:**
- Added variables but didn't click "Save Changes"
- Or page refreshed before saving

**Solution:**
- Always click "Save Changes" button
- Wait for confirmation message

---

## 🔧 EXACT FIX - Step by Step

### Step 1: Verify Current Variables

1. Go to: https://dashboard.render.com
2. Click your backend service (should be named something like "agentcraft" or "agentcraft-backend")
3. Click **Environment** in left sidebar
4. Look for existing variables

**Check:**
- Do you see `EMAIL_USER` and `EMAIL_PASS`?
- Are the names exactly correct (case-sensitive)?
- Are there any quotes around values?

### Step 2: Add/Update Variables

If variables don't exist or are incorrect:

1. Click **Add Environment Variable** (or edit existing)
2. Add exactly:

```
Key:   EMAIL_USER
Value: aakashleo420@gmail.com
```

```
Key:   EMAIL_PASS
Value: bqjnwuwhdrzyoxis
```

**CRITICAL RULES:**
- ✅ Exact names: `EMAIL_USER` and `EMAIL_PASS`
- ✅ No quotes: `value` not `"value"`
- ✅ No spaces around `=`
- ✅ Use Gmail App Password (16 characters)

### Step 3: Save Changes

1. Click **Save Changes** button
2. Wait for confirmation
3. Render will show: "Environment variables updated"

### Step 4: Trigger Manual Deploy (CRITICAL!)

**This is the most important step!**

1. Go to **Manual Deploy** section (top right)
2. Click **Deploy latest commit**
3. Wait for deployment to complete (2-3 minutes)

**Why this is necessary:**
- Environment variables are loaded at **deployment time**
- Existing running service doesn't automatically reload variables
- You must redeploy to pick up new variables

### Step 5: Verify in Logs

After deployment completes:

1. Click **Logs** tab
2. Look for startup logs:

```
🚀 Starting AgentCraft...
🔍 Environment Variables Status:
   DATABASE_URL: ✅ SET
   GROQ_API_KEY: ✅ SET
   EMAIL_USER: ✅ SET      ← Should show SET!
   EMAIL_PASS: ✅ SET      ← Should show SET!
   Available EMAIL_* vars: ['EMAIL_USER', 'EMAIL_PASS']
✅ AgentCraft ready!
```

**If you see:**
```
EMAIL_USER: ❌ MISSING
EMAIL_PASS: ❌ MISSING
```

Then variables are still not loaded. Go back to Step 1.

---

## 🐛 Debugging Steps

### Debug 1: Check Render Dashboard

**Verify variables exist:**
```
Render Dashboard → Your Service → Environment
```

**Look for:**
- `EMAIL_USER` (exact name)
- `EMAIL_PASS` (exact name)

**Common mistakes:**
- ❌ `email_user` (lowercase)
- ❌ `Email_User` (mixed case)
- ❌ `EMAIL_USERNAME` (wrong name)
- ❌ `"value"` (quotes in value)

### Debug 2: Check Deployment Status

**Verify service redeployed:**
```
Render Dashboard → Your Service → Events
```

**Look for:**
- Recent "Deploy succeeded" event
- Timestamp should be after you added variables

**If no recent deploy:**
- Variables won't be loaded
- Trigger manual deploy

### Debug 3: Check Logs

**View startup logs:**
```
Render Dashboard → Your Service → Logs
```

**Look for:**
```
🔍 Environment Variables Status:
   EMAIL_USER: ✅ SET or ❌ MISSING
   EMAIL_PASS: ✅ SET or ❌ MISSING
```

**If MISSING:**
- Variables not loaded
- Check Steps 1-4 again

### Debug 4: Check Service Name

**Verify you're in correct service:**
```
Render Dashboard → Services
```

**Look for:**
- Your backend service name
- Should be the one with Python/FastAPI
- Not a frontend or different service

---

## 📊 Render-Specific Behavior

### How Render Handles Environment Variables

1. **Set in Dashboard:**
   - Go to Service → Environment
   - Add key-value pairs
   - Click Save Changes

2. **Loaded at Deployment:**
   - Variables are injected at **deployment time**
   - Not dynamically reloaded
   - Must redeploy to pick up changes

3. **Available in Code:**
   - Python: `os.environ.get("VAR_NAME")`
   - Node.js: `process.env.VAR_NAME`
   - Available to all processes

4. **Persistent:**
   - Variables persist across deployments
   - Don't need to re-add for each deploy
   - Only need to redeploy once after adding

### Differences: Local (.env) vs Render

| Aspect | Local (.env) | Render (Production) |
|--------|--------------|---------------------|
| **File** | `.env` file in project | No file, dashboard only |
| **Loading** | `load_dotenv()` reads file | Render injects directly |
| **Access** | `os.environ.get()` | `os.environ.get()` (same) |
| **Security** | File in `.gitignore` | Secure dashboard storage |
| **Updates** | Edit file, restart app | Edit dashboard, redeploy |

**Key Point:**
- `load_dotenv()` in your code is fine
- In production, it won't find `.env` file (and that's OK)
- Render injects variables directly into environment
- Your code uses `os.environ.get()` which works for both

---

## ✅ Correct Pattern for Python

### Your Current Code (Correct!)

```python
import os

# This works for both local (.env) and production (Render)
email_user = os.environ.get("EMAIL_USER", "").strip()
email_pass = os.environ.get("EMAIL_PASS", "").strip()

if not email_user or not email_pass:
    raise ValueError("EMAIL_USER and EMAIL_PASS environment variables are not set")
```

**Why this is correct:**
- ✅ Uses `os.environ.get()` (works everywhere)
- ✅ Provides default value (`""`)
- ✅ Strips whitespace
- ✅ Validates before use
- ✅ Clear error message

### Alternative Patterns (Also Valid)

**Pattern 1: Direct access (raises KeyError if missing)**
```python
email_user = os.environ["EMAIL_USER"]  # Raises KeyError if not set
```

**Pattern 2: Using getenv (same as environ.get)**
```python
email_user = os.getenv("EMAIL_USER", "")  # Same as os.environ.get()
```

**Pattern 3: With validation**
```python
def get_required_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise ValueError(f"{key} environment variable is required")
    return value.strip()

email_user = get_required_env("EMAIL_USER")
```

---

## 🧪 Testing After Fix

### Test 1: Check Startup Logs

After redeploying, check logs for:
```
✅ AgentCraft ready!
🔍 Environment Variables Status:
   EMAIL_USER: ✅ SET
   EMAIL_PASS: ✅ SET
```

### Test 2: Run Email Workflow

1. Create workflow with Email node
2. Configure recipient
3. Run workflow
4. Check logs for:
```
📧 Email credentials check:
   EMAIL_USER present: True (length: 22)
   EMAIL_PASS present: True (length: 16)
📧 Sending to=test@example.com | subject=Test
✅ Email sent → test@example.com
```

### Test 3: Verify Email Received

1. Check recipient inbox
2. Should receive email from your Gmail
3. Subject and body should match workflow config

---

## 🔐 Security Best Practices

### Gmail App Password

**Use App Password (not regular password):**
1. Enable 2FA on Gmail account
2. Go to: https://myaccount.google.com/apppasswords
3. Generate App Password (16 characters)
4. Use this in `EMAIL_PASS`

**Why:**
- ✅ More secure than regular password
- ✅ Can be revoked without changing main password
- ✅ Required for SMTP access with 2FA

### Environment Variables

**Do:**
- ✅ Store in Render dashboard (secure)
- ✅ Use `.gitignore` for local `.env`
- ✅ Use different values for dev/prod
- ✅ Rotate credentials periodically

**Don't:**
- ❌ Commit `.env` to Git
- ❌ Hardcode in source code
- ❌ Share in public channels
- ❌ Use same password for multiple services

---

## 📋 Verification Checklist

After following all steps, verify:

- [ ] Variables exist in Render dashboard
- [ ] Variable names are exactly: `EMAIL_USER` and `EMAIL_PASS`
- [ ] No quotes around values
- [ ] Clicked "Save Changes"
- [ ] Triggered manual deploy
- [ ] Deployment succeeded
- [ ] Startup logs show: `EMAIL_USER: ✅ SET`
- [ ] Startup logs show: `EMAIL_PASS: ✅ SET`
- [ ] Email workflow runs without error
- [ ] Email is received in inbox

---

## 🎯 Quick Fix Summary

1. **Go to Render Dashboard** → Your Service → Environment
2. **Add variables:**
   - `EMAIL_USER=aakashleo420@gmail.com`
   - `EMAIL_PASS=bqjnwuwhdrzyoxis`
3. **Click "Save Changes"**
4. **Manual Deploy** → Deploy latest commit
5. **Wait 2-3 minutes** for deployment
6. **Check logs** for `✅ SET`
7. **Test email workflow**

---

## 📞 Still Not Working?

If you've followed all steps and it still doesn't work:

### Check These:

1. **Service name:**
   - Are you in the correct Render service?
   - Is it the backend service (not frontend)?

2. **Variable names:**
   - Exactly `EMAIL_USER` and `EMAIL_PASS`?
   - Case-sensitive!

3. **Deployment:**
   - Did you redeploy after adding variables?
   - Check Events tab for recent deploy

4. **Logs:**
   - What do startup logs show?
   - Copy exact log output

5. **Gmail:**
   - Is it an App Password (16 chars)?
   - Is 2FA enabled on Gmail account?

### Get Help:

1. Check Render logs for exact error
2. Copy startup environment variable status
3. Verify variable names in dashboard
4. Try removing and re-adding variables
5. Contact Render support if issue persists

---

**After adding variables and redeploying, email will work!** 📧✅
