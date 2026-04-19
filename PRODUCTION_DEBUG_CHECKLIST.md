# 🔍 Production Debugging Checklist - AgentCraft

## ✅ FIXES ALREADY APPLIED

### 1. Frontend API Configuration ✅
**Issue:** Frontend was looking for `VITE_API_BASE_URL` but env file had `VITE_API_URL`

**Fix Applied:**
- ✅ Updated `artifacts/agentcraft/src/main.tsx` to use `VITE_API_URL`
- ✅ Both API clients now use the same environment variable
- ✅ SSE streaming uses `API_BASE` from `@/lib/api.ts`

**Files Modified:**
- `artifacts/agentcraft/src/main.tsx`

---

### 2. Backend Error Handling ✅
**Issue:** Silent failures without proper logging

**Fix Applied:**
- ✅ Added comprehensive try/catch blocks to all endpoints
- ✅ Added detailed logging for workflow create/update/execute
- ✅ All errors now logged with full stack traces
- ✅ Proper HTTP 500 responses with error details

**Files Modified:**
- `backend/main.py` (all CRUD endpoints)

---

### 3. Database Connection ✅
**Issue:** SSL configuration for Neon PostgreSQL

**Fix Applied:**
- ✅ Correct SSL parameter for asyncpg: `ssl="require"`
- ✅ Connection pooling configured
- ✅ Pool pre-ping enabled
- ✅ Proper connection lifecycle management

**Files Modified:**
- `backend/database.py`

---

### 4. CORS Configuration ✅
**Issue:** Potential CORS blocking in production

**Fix Applied:**
- ✅ CORS middleware configured with `allow_origins=["*"]`
- ✅ All methods and headers allowed
- ✅ Works for both REST and SSE

**Files Modified:**
- `backend/main.py`

---

### 5. Email Subject Line Sanitization ✅
**Issue:** Email node failing with newlines in subject

**Fix Applied:**
- ✅ `_sanitize_subject()` function strips newlines
- ✅ Takes only first line
- ✅ Caps at 200 characters
- ✅ Fallback to default subject

**Files Modified:**
- `backend/workflow_engine.py`

---

### 6. Execution Output Handling ✅
**Issue:** Final output not appearing in UI

**Fix Applied:**
- ✅ SSE sends `execution_complete` event with `finalOutput`
- ✅ Frontend listens for completion event
- ✅ Output panel slides in automatically
- ✅ No manual refresh required

**Files Modified:**
- `backend/main.py` (SSE stream)
- `artifacts/agentcraft/src/pages/execution-detail.tsx`
- `artifacts/agentcraft/src/pages/builder.tsx`

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Deploy Backend to Render

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Production fixes: API config, error handling, SSE output"
   git push origin main
   ```

2. **Verify Render Environment Variables**
   Go to Render Dashboard → Environment:
   ```env
   DATABASE_URL=postgresql://neondb_owner:***@ep-red-smoke-a4vtyk30-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   AI_PROVIDER=groq
   GROQ_API_KEY=gsk_***
   GROQ_BASE_URL=https://api.groq.com/openai/v1
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   SESSION_SECRET=your-production-secret
   ```

3. **Wait for Deployment**
   - Render will auto-deploy from GitHub
   - Watch logs for: `✅ AgentCraft ready!`

4. **Test Backend Health**
   ```bash
   curl https://agentcraft-kexf.onrender.com/api/healthz
   # Expected: {"status":"ok"}
   ```

---

### Step 2: Deploy Frontend to Vercel

1. **Verify Vercel Environment Variables**
   Go to Vercel Dashboard → Settings → Environment Variables:
   ```env
   VITE_API_URL=https://agentcraft-kexf.onrender.com
   ```
   
   **CRITICAL:**
   - ✅ Variable name must be exactly `VITE_API_URL` (not `VITE_API_BASE_URL`)
   - ✅ No trailing slash
   - ✅ Must start with `https://`

2. **Trigger Redeploy**
   - If you just added/changed the environment variable, you MUST redeploy
   - Go to Deployments → Click "..." → Redeploy

3. **Verify Frontend**
   - Open your Vercel URL in browser
   - Open DevTools → Console
   - Look for: `[AgentCraft] API → https://agentcraft-kexf.onrender.com`
   - If you see `[AgentCraft] API → /api (via Vite proxy)`, the env var is not set!

---

## 🧪 TESTING CHECKLIST

### Test 1: Workflow Save
1. Open app in browser
2. Create a new workflow
3. Add a few nodes
4. Click "Save"
5. ✅ Should see: "✓ Workflow saved"
6. ❌ If error: Check browser Network tab and Render logs

**Expected Network Request:**
```
POST https://agentcraft-kexf.onrender.com/api/workflows
Status: 201 Created
Response: {"id":1,"name":"...","nodes":[...],"edges":[...]}
```

**Expected Backend Log:**
```
POST /api/workflows | name=My Workflow | nodes=3 | edges=2
✅ POST /api/workflows → created id=1
```

---

### Test 2: Workflow Execution
1. Open a saved workflow
2. Click "Run Workflow"
3. Enter input text
4. Click "Run Now"
5. ✅ Should navigate to `/executions/{id}` immediately
6. ✅ Should see logs streaming in real-time
7. ✅ Should see final output appear automatically (no refresh)

**Expected Network Requests:**
```
POST https://agentcraft-kexf.onrender.com/api/executions
Status: 202 Accepted
Response: {"id":1,"workflowId":1,"status":"pending"}

GET https://agentcraft-kexf.onrender.com/api/executions/1/stream
Status: 200 OK (SSE stream)
```

**Expected Backend Logs:**
```
POST /api/executions | workflowId=1 | input=...
✅ POST /api/executions → created id=1 for workflow 1
Running execution 1
🚀 Starting execution | nodes=3 | input: ...
⚙️  [AI Agent] type=ai_agent
✅ Execution 1 finished → completed | FINAL OUTPUT: ...
SSE: Sending completion event for execution 1 | status=completed | output=...
```

---

### Test 3: SSE Streaming
1. Start an execution
2. Watch the execution detail page
3. ✅ Logs should appear in real-time (no delay)
4. ✅ Node status should update as they execute
5. ✅ Final output should slide in when complete

**Expected Console Logs:**
```
🔌 SSE: Connecting to execution stream 1
✅ SSE: Connected
📨 SSE EVENT: {type: "log", message: "..."}
📨 SSE EVENT: {type: "node_update", nodeId: "...", status: "success"}
📨 SSE EVENT: {type: "execution_complete", status: "completed", finalOutput: "..."}
🎉 Execution complete!
```

---

## 🐛 TROUBLESHOOTING

### Issue: "Failed to save workflow"

**Symptoms:**
- Frontend shows error toast
- Network tab shows 500 error

**Debug Steps:**

1. **Check Browser Console**
   ```javascript
   // Look for:
   [api] POST https://agentcraft-kexf.onrender.com/api/workflows
   ApiError: HTTP 500: ...
   ```

2. **Check Network Tab**
   - Request URL: Should be `https://agentcraft-kexf.onrender.com/api/workflows`
   - Status: If 404 → wrong URL, if 500 → backend error
   - Response: Check error message

3. **Check Render Logs**
   ```
   # Look for:
   POST /api/workflows | name=... | nodes=... | edges=...
   ❌ Failed to create workflow: [error details]
   ```

4. **Common Causes:**
   - Database connection failed → Check `DATABASE_URL`
   - JSON serialization error → Check nodes/edges structure
   - Missing environment variable → Check Render dashboard

---

### Issue: "Execution not starting"

**Symptoms:**
- Click "Run Workflow" → nothing happens
- No navigation to execution page

**Debug Steps:**

1. **Check Browser Console**
   ```javascript
   // Look for:
   🚀 Execution started: 1
   // Or error:
   ApiError: HTTP 500: ...
   ```

2. **Check Network Tab**
   ```
   POST https://agentcraft-kexf.onrender.com/api/executions
   Status: 202 Accepted
   Response: {"id":1,"workflowId":1,"status":"pending"}
   ```

3. **Check Render Logs**
   ```
   POST /api/executions | workflowId=1 | input=...
   ✅ POST /api/executions → created id=1
   Running execution 1
   ```

4. **Common Causes:**
   - Workflow not saved → Save first
   - Database error → Check logs
   - AI API key missing → Check `GROQ_API_KEY`

---

### Issue: "SSE not connecting"

**Symptoms:**
- Execution page loads but no logs appear
- Console shows SSE connection error

**Debug Steps:**

1. **Check Browser Console**
   ```javascript
   // Look for:
   🔌 SSE: Connecting to execution stream 1
   ✅ SSE: Connected
   // Or error:
   ❌ SSE Connection error: ...
   ```

2. **Check Network Tab**
   ```
   GET https://agentcraft-kexf.onrender.com/api/executions/1/stream
   Status: 200 OK
   Type: text/event-stream
   ```

3. **Test SSE Directly**
   ```bash
   curl -N https://agentcraft-kexf.onrender.com/api/executions/1/stream
   # Should stream events:
   data: {"type":"log","message":"..."}
   data: {"type":"execution_complete","status":"completed","finalOutput":"..."}
   ```

4. **Common Causes:**
   - CORS blocking → Already fixed
   - Execution doesn't exist → Check execution ID
   - Backend crashed → Check Render logs

---

### Issue: "Output not appearing"

**Symptoms:**
- Execution completes but no output shown
- Need to refresh to see output

**Debug Steps:**

1. **Check Browser Console**
   ```javascript
   // Look for:
   📨 SSE EVENT: {type: "execution_complete", status: "completed", finalOutput: "..."}
   🎉 Execution complete!
   ✅ Builder: Setting final output: ...
   ```

2. **Check Backend Logs**
   ```
   ✅ Execution 1 finished → completed | FINAL OUTPUT: ...
   SSE: Sending completion event for execution 1 | status=completed | output=...
   ```

3. **Check SSE Stream**
   ```bash
   curl -N https://agentcraft-kexf.onrender.com/api/executions/1/stream
   # Should end with:
   data: {"type":"execution_complete","status":"completed","finalOutput":"..."}
   ```

4. **Common Causes:**
   - SSE not sending completion event → Check backend logs
   - Frontend not handling event → Check console
   - Output is empty string → Check workflow logic

---

## 📊 MONITORING

### Key Metrics

1. **Response Times**
   - API calls: < 500ms
   - Database queries: < 100ms
   - AI calls: 2-5 seconds (normal)

2. **Error Rates**
   - 500 errors: Should be 0%
   - 404 errors: Check for wrong routes

3. **Database**
   - Connection pool: Should not be exhausted
   - Query performance: Monitor slow queries

### Logging

All endpoints now log:
```python
# Success
✅ POST /api/workflows → created id=1

# Error
❌ Failed to create workflow: [error details with stack trace]
```

---

## 🎉 SUCCESS INDICATORS

When everything works correctly:

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

---

## 📞 NEXT STEPS

1. **Deploy Backend**
   - Push code to GitHub
   - Wait for Render deployment
   - Check logs for `✅ AgentCraft ready!`

2. **Deploy Frontend**
   - Verify `VITE_API_URL` in Vercel
   - Redeploy if environment variable changed
   - Check console for correct API URL

3. **Test Everything**
   - Create workflow → Save → Run
   - Verify logs stream in real-time
   - Verify output appears automatically

4. **Monitor**
   - Watch Render logs for errors
   - Check Vercel logs for build issues
   - Monitor user reports

---

**All fixes are in place. Ready for production deployment!** 🚀
