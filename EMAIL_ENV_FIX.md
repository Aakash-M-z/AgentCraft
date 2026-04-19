# 🔧 Email Environment Variables Fix - AgentCraft

## ✅ ISSUE: Email Node Fails in Production

**Error Message:**
```
EMAIL_USER and EMAIL_PASS environment variables are not set
```

**Root Cause:** Environment variables not properly configured in Render dashboard.

---

## 🔍 DEBUG LOGGING ADDED

I've added comprehensive debug logging to help diagnose the issue:

### 1. Startup Logging (main.py)
On application startup, you'll now see:
```
🔍 Environment Variables Status:
   DATABASE_URL: ✅ SET
   GROQ_API_KEY: ✅ SET
   EMAIL_USER: ❌ MISSING  ← This is the problem!
   EMAIL_PASS: ❌ MISSING  ← This is the problem!
   Available EMAIL_* vars: []
```

### 2. Email Send Logging (workflow_engine.py)
When email node executes, you'll see:
```
📧 Email credentials check:
   EMAIL_USER present: False (length: 0)
   EMAIL_PASS present: False (length: 0)
   os.getenv EMAIL_USER: False
   os.getenv EMAIL_PASS: False
   Available EMAIL_* vars: []
```

---

## 🔧 FIX: Configure Render Environment Variables

### Step 1: Go to Render Dashboard

1. Open: https://dashboard.render.com
2. Click your service: **agentcraft** (or your backend service name)
3. Click: **Environment** (left sidebar)

### Step 2: Add Environment Variables

Click **Add Environment Variable** and add these **EXACTLY**:

#### Variable 1:
```
Key:   EMAIL_USER
Value: aakashleo420@gmail.com
```

#### Variable 2:
```
Key:   EMAIL_PASS
Value: bqjnwuwhdrzyoxis
```

**CRITICAL RULES:**
- ✅ Variable names are **case-sensitive**: `EMAIL_USER` (not `email_user` or `Email_User`)
- ✅ **No quotes** around values: `aakashleo420@gmail.com` (not `"aakashleo420@gmail.com"`)
- ✅ **No spaces** around `=`: `EMAIL_USER=value` (not `EMAIL_USER = value`)
- ✅ Use **Gmail App Password** (not your regular Gmail password)

### Step 3: Save and Redeploy

1. Click **Save Changes**
2. Render will automatically redeploy
3. Wait for deployment to complete (2-3 minutes)

### Step 4: Verify in Logs

After deployment, check Render logs for:

```
🔍 Environment Variables Status:
   DATABASE_URL: ✅ SET
   GROQ_API_KEY: ✅ SET
   EMAIL_USER: ✅ SET      ← Should now be SET!
   EMAIL_PASS: ✅ SET      ← Should now be SET!
   Available EMAIL_* vars: ['EMAIL_USER', 'EMAIL_PASS']
```

---

## 🧪 TEST EMAIL NODE

### Step 1: Create Test Workflow

1. Go to your app
2. Create workflow with:
   - **Input Node** → "Test email"
   - **Email Node** → Configure:
     - To: `your-test-email@example.com`
     - Subject: `Test from AgentCraft`
     - Body: `{{input}}`

### Step 2: Run Workflow

1. Click "Run Workflow"
2. Enter input: "This is a test"
3. Check execution logs

### Step 3: Verify Success

**In Render logs, you should see:**
```
📧 Email credentials check:
   EMAIL_USER present: True (length: 22)
   EMAIL_PASS present: True (length: 16)
   os.getenv EMAIL_USER: True
   os.getenv EMAIL_PASS: True
   Available EMAIL_* vars: ['EMAIL_USER', 'EMAIL_PASS']
```

**Then:**
```
📧 Sending to=your-test-email@example.com | subject=Test from AgentCraft
✅ Email sent → your-test-email@example.com
```

---

## 🐛 TROUBLESHOOTING

### Issue 1: Still showing "MISSING" after adding variables

**Possible causes:**

1. **Didn't redeploy after adding variables**
   - Solution: Go to Render → Manual Deploy → Deploy latest commit

2. **Variable names don't match exactly**
   - Check: Must be `EMAIL_USER` and `EMAIL_PASS` (case-sensitive)
   - Not: `email_user`, `Email_User`, `EMAIL_USERNAME`, etc.

3. **Added quotes around values**
   - Wrong: `"aakashleo420@gmail.com"`
   - Right: `aakashleo420@gmail.com`

4. **Added spaces**
   - Wrong: `EMAIL_USER = value`
   - Right: `EMAIL_USER=value`

---

### Issue 2: Variables show as SET but email still fails

**Check Render logs for:**
```
📧 Email credentials check:
   EMAIL_USER present: True (length: 22)
   EMAIL_PASS present: True (length: 16)
```

**If you see this but email still fails, check:**

1. **Gmail App Password is correct**
   - Not your regular Gmail password
   - Generate at: https://myaccount.google.com/apppasswords
   - Must be 16 characters

2. **Gmail account has 2FA enabled**
   - App Passwords only work with 2FA enabled
   - Enable at: https://myaccount.google.com/security

3. **SMTP connection error**
   - Check Render logs for: `SMTPAuthenticationError`
   - Regenerate App Password if needed

---

### Issue 3: Variables disappear after deployment

**This shouldn't happen, but if it does:**

1. **Check Render service settings**
   - Environment variables should persist across deployments
   - If they don't, contact Render support

2. **Verify you're looking at the right service**
   - Make sure you're in the correct Render service
   - Not a preview deployment or different environment

---

## 📊 VERIFICATION CHECKLIST

After fixing, verify:

- [ ] Render logs show: `EMAIL_USER: ✅ SET`
- [ ] Render logs show: `EMAIL_PASS: ✅ SET`
- [ ] Render logs show: `Available EMAIL_* vars: ['EMAIL_USER', 'EMAIL_PASS']`
- [ ] Email node executes without error
- [ ] Email is received in inbox
- [ ] No "environment variables are not set" error

---

## 🔐 SECURITY NOTE

**Gmail App Password:**
- ✅ Use App Password (16 characters)
- ❌ Don't use regular Gmail password
- ✅ Enable 2FA on Gmail account
- ✅ Generate at: https://myaccount.google.com/apppasswords

**Environment Variables:**
- ✅ Set in Render dashboard (secure)
- ❌ Don't commit to Git
- ✅ Already in `.gitignore`

---

## 📝 RENDER DASHBOARD SCREENSHOT GUIDE

### Where to Add Variables:

```
Render Dashboard
└── Your Service (agentcraft)
    └── Environment (left sidebar)
        └── Environment Variables section
            └── [Add Environment Variable] button
                ├── Key: EMAIL_USER
                ├── Value: aakashleo420@gmail.com
                └── [Add] button
```

---

## 🎯 EXPECTED RESULT

After fix:

**Startup Logs:**
```
🚀 Starting AgentCraft...
🔍 Environment Variables Status:
   DATABASE_URL: ✅ SET
   GROQ_API_KEY: ✅ SET
   EMAIL_USER: ✅ SET
   EMAIL_PASS: ✅ SET
   Available EMAIL_* vars: ['EMAIL_USER', 'EMAIL_PASS']
✅ Database tables initialized successfully
✅ AgentCraft ready!
```

**Email Execution Logs:**
```
📧 Email credentials check:
   EMAIL_USER present: True (length: 22)
   EMAIL_PASS present: True (length: 16)
   Available EMAIL_* vars: ['EMAIL_USER', 'EMAIL_PASS']
📧 Sending to=test@example.com | subject=Test
✅ Email sent → test@example.com
```

**User Experience:**
- ✅ Email node works in production
- ✅ No environment variable errors
- ✅ Emails delivered successfully

---

## 🚀 QUICK FIX SUMMARY

1. **Go to Render Dashboard** → Your Service → Environment
2. **Add variables:**
   - `EMAIL_USER=aakashleo420@gmail.com`
   - `EMAIL_PASS=bqjnwuwhdrzyoxis`
3. **Save and wait for redeploy** (2-3 minutes)
4. **Check logs** for `✅ SET`
5. **Test email node** in production

---

## 📞 STILL NOT WORKING?

If you've followed all steps and it still doesn't work:

1. **Check Render logs** for the startup verification
2. **Copy the exact log output** showing environment variable status
3. **Check for typos** in variable names (case-sensitive!)
4. **Try manual redeploy** from Render dashboard
5. **Verify Gmail App Password** is correct (16 characters)

---

**Email functionality will work after adding these environment variables!** 📧✅
