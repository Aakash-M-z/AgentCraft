# ⚡ Quick Start: Deploy to Production

## 🎯 Goal
Deploy AgentCraft to production with all fixes applied.

---

## ✅ Pre-Deployment Checklist

All critical fixes are already in place:
- ✅ Frontend uses `VITE_API_URL` (not `VITE_API_BASE_URL`)
- ✅ Backend has comprehensive error handling
- ✅ Database SSL configured for Neon
- ✅ CORS enabled for production
- ✅ SSE sends completion events with output
- ✅ Email subject sanitization

---

## 🚀 Deploy in 3 Steps

### Step 1: Push to GitHub (2 minutes)

```bash
# Commit all changes
git add .
git commit -m "Production fixes: API config, error handling, SSE output"
git push origin main
```

**What happens:**
- Render auto-deploys backend
- Wait for: `✅ AgentCraft ready!` in Render logs

---

### Step 2: Configure Vercel (1 minute)

1. Go to: https://vercel.com/dashboard
2. Click your project → Settings → Environment Variables
3. **Add or verify:**
   ```
   Name:  VITE_API_URL
   Value: https://agentcraft-kexf.onrender.com
   ```
4. **Important:** No trailing slash!
5. If you just added/changed it → Redeploy:
   - Go to Deployments
   - Click "..." on latest deployment
   - Click "Redeploy"

---

### Step 3: Test (2 minutes)

1. **Open your Vercel URL**
2. **Check console:**
   - Should see: `[AgentCraft] API → https://agentcraft-kexf.onrender.com`
   - ❌ If you see `/api (via Vite proxy)` → env var not set!

3. **Test workflow:**
   - Create workflow → Add nodes → Save
   - ✅ Should see: "✓ Workflow saved"

4. **Test execution:**
   - Click "Run Workflow" → Enter input → Run
   - ✅ Should navigate to execution page
   - ✅ Should see logs streaming
   - ✅ Should see output appear automatically

---

## 🐛 Quick Troubleshooting

### "Failed to save workflow"
**Fix:** Check Vercel env var is `VITE_API_URL` (not `VITE_API_BASE_URL`)

### "Output not appearing"
**Fix:** Already fixed! Just redeploy backend (push to GitHub)

### "SSE not connecting"
**Fix:** Already fixed! CORS is configured

---

## 📊 Success Indicators

**Frontend Console:**
```
[AgentCraft] API → https://agentcraft-kexf.onrender.com
```

**Backend Logs:**
```
✅ AgentCraft ready!
```

**User Experience:**
- Workflows save instantly ✅
- Executions start immediately ✅
- Logs stream live ✅
- Output appears automatically ✅

---

## 🎉 Done!

Your app is now production-ready with all fixes applied.

**Need more details?**
- See `DEPLOYMENT_SUMMARY.md` for complete overview
- See `PRODUCTION_DEBUG_CHECKLIST.md` for detailed debugging

**Ready to deploy!** 🚀
