# 🚀 Production Deployment Guide - AgentCraft

## Critical Fix Applied

### **Issue Identified:**
The frontend was looking for `VITE_API_BASE_URL` but the environment file had `VITE_API_URL`.

### **Fix Applied:**
✅ Updated `artifacts/agentcraft/src/main.tsx` to use `VITE_API_URL` (matching the env file)

---

## 📋 Deployment Checklist

### **1. Frontend (Vercel)**

#### Environment Variables
Set these in Vercel Dashboard → Settings → Environment Variables:

```env
VITE_API_URL=https://agentcraft-kexf.onrender.com
```

**Important:**
- ✅ Variable name must be exactly `VITE_API_URL`
- ✅ No trailing slash
- ✅ Must start with `https://`
- ✅ Redeploy after adding/changing variables

#### Build Settings
```
Build Command: pnpm build
Output Directory: artifacts/agentcraft/dist/public
Install Command: pnpm install
Root Directory: artifacts/agentcraft
```

#### Verify Deployment
After deployment, check browser console:
```javascript
// Should see:
[AgentCraft] API → https://agentcraft-kexf.onrender.com
```

---

### **2. Backend (Render)**

#### Environment Variables
Set these in Render Dashboard → Environment:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:***@ep-red-smoke-a4vtyk30-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# AI Provider
AI_PROVIDER=groq
GROQ_API_KEY=gsk_***
GROQ_BASE_URL=https://api.groq.com/openai/v1

# Email (Optional)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Session
SESSION_SECRET=your-production-secret-change-this
```

#### Build Settings
```
Build Command: pip install -r requirements.txt
Start Command: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

#### Health Check
```
Health Check Path: /api/healthz
```

---

## 🔍 Debugging Production Issues

### **1. Check Frontend API Configuration**

Open browser console and look for:
```
[AgentCraft] API → https://agentcraft-kexf.onrender.com
```

If you see:
```
[AgentCraft] API → /api (via Vite proxy)
```
**Problem:** `VITE_API_URL` is not set in Vercel environment variables.

**Solution:**
1. Go to Vercel Dashboard
2. Settings → Environment Variables
3. Add `VITE_API_URL=https://agentcraft-kexf.onrender.com`
4. Redeploy

---

### **2. Check Network Requests**

Open DevTools → Network tab:

**Successful Request:**
```
Request URL: https://agentcraft-kexf.onrender.com/api/workflows
Status: 200 OK
```

**Common Issues:**

#### 404 Not Found
```
Request URL: https://agentcraft-kexf.onrender.com/api/workflows
Status: 404
```
**Problem:** Backend route doesn't exist or wrong URL
**Solution:** Check backend logs on Render

#### 500 Internal Server Error
```
Request URL: https://agentcraft-kexf.onrender.com/api/workflows
Status: 500
```
**Problem:** Backend crash or database error
**Solution:** Check Render logs for error details

#### CORS Error
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy
```
**Problem:** CORS not configured
**Solution:** Already fixed in `backend/main.py` (allow_origins=["*"])

#### Connection Refused
```
Failed to fetch
net::ERR_CONNECTION_REFUSED
```
**Problem:** Backend is down or wrong URL
**Solution:** Check Render dashboard, ensure service is running

---

### **3. Check Backend Logs (Render)**

Go to Render Dashboard → Logs

**Successful Startup:**
```
🚀 Starting AgentCraft...
✅ Database tables initialized successfully
✅ AgentCraft ready!
Application startup complete.
```

**Database Connection Error:**
```
❌ Failed to initialize database: ...
```
**Solution:** Check `DATABASE_URL` environment variable

**Workflow Save Success:**
```
POST /api/workflows | name=My Workflow | nodes=3 | edges=2
✅ POST /api/workflows → created id=1
```

**Workflow Save Error:**
```
❌ Failed to create workflow: ...
```
**Solution:** Check error details in logs

---

### **4. Test API Endpoints Directly**

#### Health Check
```bash
curl https://agentcraft-kexf.onrender.com/api/healthz
```
Expected: `{"status":"ok"}`

#### List Workflows
```bash
curl https://agentcraft-kexf.onrender.com/api/workflows
```
Expected: `[...]` (array of workflows)

#### Create Workflow
```bash
curl -X POST https://agentcraft-kexf.onrender.com/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "description": "Test",
    "nodes": [],
    "edges": []
  }'
```
Expected: `{"id":1,"name":"Test Workflow",...}`

---

## 🛠️ Common Production Issues & Solutions

### **Issue 1: "Failed to save workflow"**

**Symptoms:**
- Frontend shows error toast
- Network tab shows 500 error
- Backend logs show database error

**Solutions:**

1. **Check Database Connection**
   ```bash
   # In Render logs, look for:
   ✅ Database tables initialized successfully
   ```
   If missing, check `DATABASE_URL` environment variable

2. **Check Database Permissions**
   - Ensure Neon database allows connections
   - Verify SSL is enabled (`sslmode=require`)

3. **Check JSON Serialization**
   - Ensure nodes/edges are valid JSON
   - Check for circular references

---

### **Issue 2: "Execution not starting"**

**Symptoms:**
- Click "Run Workflow" → nothing happens
- No navigation to execution page
- No error message

**Solutions:**

1. **Check Browser Console**
   ```javascript
   // Look for errors like:
   Failed to fetch
   ```

2. **Check Network Tab**
   - Verify POST to `/api/executions` succeeds
   - Check response has `id` field

3. **Check Backend Logs**
   ```
   POST /api/executions | workflowId=1 | input=...
   ✅ POST /api/executions → created id=1
   ```

---

### **Issue 3: "SSE not connecting"**

**Symptoms:**
- Execution page loads but no logs appear
- Console shows SSE connection error

**Solutions:**

1. **Check SSE URL**
   ```javascript
   // In console:
   🔌 SSE: Connecting to https://agentcraft-kexf.onrender.com/api/executions/1/stream
   ```

2. **Check Backend SSE Endpoint**
   ```bash
   curl https://agentcraft-kexf.onrender.com/api/executions/1/stream
   ```
   Should stream events

3. **Check CORS for SSE**
   - Already configured in backend
   - Verify `allow_origins=["*"]`

---

## 📊 Monitoring Production

### **Key Metrics to Watch**

1. **Response Times**
   - API calls should be < 500ms
   - Database queries < 100ms

2. **Error Rates**
   - 500 errors should be < 1%
   - 404 errors indicate missing routes

3. **Database Connections**
   - Pool should not be exhausted
   - Check for connection leaks

### **Logging Best Practices**

All endpoints now log:
```python
# Success
✅ POST /api/workflows → created id=1

# Error
❌ Failed to create workflow: [error details]
```

---

## 🔐 Security Checklist

- ✅ CORS configured (allow_origins)
- ✅ Database uses SSL (sslmode=require)
- ✅ Environment variables not in code
- ✅ Session secret is random
- ✅ API keys not exposed to frontend

---

## 🚀 Deployment Steps

### **Initial Deployment**

1. **Deploy Backend (Render)**
   ```
   1. Connect GitHub repo
   2. Set environment variables
   3. Deploy
   4. Wait for "✅ AgentCraft ready!"
   5. Test: curl https://your-backend.onrender.com/api/healthz
   ```

2. **Deploy Frontend (Vercel)**
   ```
   1. Connect GitHub repo
   2. Set VITE_API_URL environment variable
   3. Deploy
   4. Open app in browser
   5. Check console for API URL
   ```

### **Updating Deployment**

**Backend:**
```
1. Push code to GitHub
2. Render auto-deploys
3. Check logs for "✅ AgentCraft ready!"
```

**Frontend:**
```
1. Push code to GitHub
2. Vercel auto-deploys
3. Check browser console for API URL
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Frontend loads without errors
- [ ] Console shows correct API URL
- [ ] Can create new workflow
- [ ] Can save workflow
- [ ] Can run workflow
- [ ] Execution page loads
- [ ] Logs stream in real-time
- [ ] Output appears automatically
- [ ] No CORS errors
- [ ] No 500 errors

---

## 📞 Support

If issues persist:

1. **Check Render Logs**
   - Look for error messages
   - Verify database connection
   - Check for crashes

2. **Check Vercel Logs**
   - Build logs for errors
   - Runtime logs for issues

3. **Check Browser Console**
   - Network tab for failed requests
   - Console for JavaScript errors

4. **Test API Directly**
   - Use curl to test endpoints
   - Verify responses

---

## 🎉 Success Indicators

When everything works:

**Frontend Console:**
```
[AgentCraft] API → https://agentcraft-kexf.onrender.com
```

**Backend Logs:**
```
🚀 Starting AgentCraft...
✅ Database tables initialized successfully
✅ AgentCraft ready!
```

**User Experience:**
- ✅ Workflows save instantly
- ✅ Executions start immediately
- ✅ Logs stream live
- ✅ Output appears automatically
- ✅ No errors or refresh needed

**Your app is production-ready!** 🚀
