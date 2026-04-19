# ⚡ Fix Email on Render - Quick Action

## 🎯 Problem
Email fails with: "EMAIL_USER and EMAIL_PASS environment variables are not set"

## ✅ 5-Minute Fix

### Step 1: Add Variables (2 min)

1. Go to: https://dashboard.render.com
2. Click your **backend service**
3. Click **Environment** (left sidebar)
4. Click **Add Environment Variable**

Add these **exactly**:

```
Key:   EMAIL_USER
Value: aakashleo420@gmail.com
```

```
Key:   EMAIL_PASS
Value: bqjnwuwhdrzyoxis
```

**IMPORTANT:**
- ✅ No quotes: `value` not `"value"`
- ✅ Case-sensitive: `EMAIL_USER` not `email_user`

5. Click **Save Changes**

---

### Step 2: Redeploy (2 min) - CRITICAL!

**This is the most important step!**

1. Click **Manual Deploy** (top right)
2. Click **Deploy latest commit**
3. Wait for deployment (2-3 minutes)

**Why:** Variables are loaded at deployment time. You MUST redeploy!

---

### Step 3: Verify (1 min)

1. Click **Logs** tab
2. Look for:

```
🔍 Environment Variables Status:
   EMAIL_USER: ✅ SET
   EMAIL_PASS: ✅ SET
```

**If you see `❌ MISSING`:**
- Go back to Step 1
- Check variable names are exact
- Make sure you clicked "Save Changes"
- Redeploy again

---

## 🧪 Test

1. Run workflow with Email node
2. Check logs for:
```
📧 Email credentials check:
   EMAIL_USER present: True
✅ Email sent
```

---

## 🐛 Still Not Working?

### Common Issues:

**Issue 1: Still showing MISSING**
- Variable names must be exactly: `EMAIL_USER` and `EMAIL_PASS`
- Case-sensitive!
- No typos

**Issue 2: Didn't redeploy**
- Variables only load at deployment time
- Must click "Manual Deploy" → "Deploy latest commit"

**Issue 3: Wrong service**
- Make sure you're in the backend service
- Not frontend or different service

**Issue 4: Quotes in value**
- Wrong: `"aakashleo420@gmail.com"`
- Right: `aakashleo420@gmail.com`

---

## 📖 Detailed Guide

See `RENDER_ENV_VARS_GUIDE.md` for:
- Complete troubleshooting
- Render-specific behavior
- Security best practices
- All debugging steps

---

## 🎯 Checklist

- [ ] Added `EMAIL_USER` in Render dashboard
- [ ] Added `EMAIL_PASS` in Render dashboard
- [ ] Clicked "Save Changes"
- [ ] Triggered manual deploy
- [ ] Waited for deployment to complete
- [ ] Checked logs show `✅ SET`
- [ ] Tested email workflow

---

**Email will work after redeploying!** 📧✅

**Don't forget to redeploy - that's the key!** 🔑
