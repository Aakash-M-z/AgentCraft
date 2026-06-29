# 🚀 Enterprise Report Generator - Quick Setup Guide

## Installation Steps

### 1. Install Backend Dependencies

```bash
# From project root
pip install reportlab>=4.0.0

# Or install all dependencies
pip install -r requirements.txt
```

### 2. Verify Installation

```bash
python -c "import reportlab; print('reportlab installed:', reportlab.__version__)"
```

### 3. Start Backend Server

```bash
# From project root
python -m backend.main

# Or if using uvicorn directly
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Start Frontend Development Server

```bash
cd artifacts/agentcraft
npm install  # if not already installed
npm run dev
```

### 5. Test the Feature

1. **Open AgentCraft** - Navigate to `http://localhost:5173`

2. **Run a Workflow**
   - Go to "Workflows" page
   - Select "Enterprise AI Procurement Orchestrator" (pre-seeded)
   - Or create any custom workflow
   - Click "Run" and enter input

3. **View Report**
   - When execution completes, you'll see a "View Enterprise Report" button
   - Click it to see the animated loading sequence
   - Report will display with:
     - Interactive dashboard with metrics
     - AI-generated executive summary
     - Detailed sections
     - Comprehensive audit trail

4. **Test Export Features**
   - **Download PDF** - Click to download professional PDF
   - **Print** - Browser print preview
   - **Markdown** - Export as .md file
   - **JSON** - Copy raw data

---

## Quick Test with Procurement Workflow

The fastest way to test is using the pre-seeded procurement workflow:

```bash
# 1. Start servers (backend and frontend)

# 2. Navigate to http://localhost:5173

# 3. Go to "Workflows" page

# 4. Click on "Enterprise AI Procurement Orchestrator"

# 5. Click "Run Workflow"

# 6. Enter: "I need to purchase 10 Dell laptops for the engineering team"

# 7. Watch workflow execute

# 8. When complete, click "View Enterprise Report"

# 9. See professional report with:
#    - Purchase Order details
#    - Budget analysis
#    - Vendor recommendations
#    - Risk assessment
#    - AI executive summary
#    - Download as PDF
```

---

## Troubleshooting

### reportlab Not Found

```bash
# Solution 1: Direct install
pip install reportlab

# Solution 2: Upgrade pip first
python -m pip install --upgrade pip
pip install reportlab

# Solution 3: Use conda if available
conda install -c conda-forge reportlab
```

### API Endpoint 404

**Issue:** `/api/executions/{id}/report` returns 404

**Solution:**
- Restart backend server after installing new code
- Clear Python cache: `find . -type d -name __pycache__ -exec rm -r {} +`
- Verify `report_generator.py`, `report_templates.py`, and `pdf_generator.py` exist in `backend/`

### GROQ API Key Missing

**Issue:** Executive summary shows fallback text

**Solution:**
- Set environment variable: `export GROQ_API_KEY=your_key_here`
- Or add to `.env` file: `GROQ_API_KEY=your_key_here`
- Restart backend server

### PDF Generation Fails

**Issue:** PDF download shows error

**Solution:**
- Check backend logs for detailed error
- Verify reportlab is installed: `python -c "import reportlab"`
- Check report data is valid (view JSON export first)
- Try with a simpler workflow first

---

## Verification Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads successfully
- [ ] Can create and run workflow
- [ ] Execution completes successfully
- [ ] "View Enterprise Report" button appears
- [ ] Loading animation plays smoothly
- [ ] Report displays with all sections
- [ ] Metrics dashboard shows data
- [ ] Executive summary is present (not fallback)
- [ ] PDF downloads successfully
- [ ] PDF opens and looks professional
- [ ] Markdown export works
- [ ] JSON export works
- [ ] Print preview looks good

---

## File Checklist

Verify these files exist:

**Backend:**
- [ ] `backend/report_generator.py`
- [ ] `backend/report_templates.py`
- [ ] `backend/pdf_generator.py`
- [ ] `backend/main.py` (updated with new endpoints)
- [ ] `requirements.txt` (includes reportlab)

**Frontend:**
- [ ] `artifacts/agentcraft/src/components/reports/ReportViewer.tsx`
- [ ] `artifacts/agentcraft/src/components/reports/ReportDashboard.tsx`
- [ ] `artifacts/agentcraft/src/components/reports/ExecutiveSummary.tsx`
- [ ] `artifacts/agentcraft/src/components/reports/ReportSection.tsx`
- [ ] `artifacts/agentcraft/src/components/reports/AuditTrail.tsx`
- [ ] `artifacts/agentcraft/src/components/reports/LoadingSequence.tsx`
- [ ] `artifacts/agentcraft/src/pages/execution-detail.tsx` (updated)

---

## Performance Tips

### For Development

- Use `npm run dev` for hot reload
- Use `uvicorn --reload` for backend auto-restart
- Keep browser console open for debugging
- Check Network tab for API calls

### For Production

- Build frontend: `npm run build`
- Use production server: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
- Enable caching for reports (future enhancement)
- Use CDN for static assets

---

## What's Working

✅ **Backend:**
- Report generation from execution data
- Workflow type auto-detection
- AI executive summary generation
- Template system with 10 templates
- PDF generation with reportlab
- API endpoints for report and PDF

✅ **Frontend:**
- Animated loading sequence
- Interactive dashboard with metrics
- Beautiful executive summary display
- Flexible section rendering
- Comprehensive audit trail
- Multiple export options
- Integration with execution detail page

✅ **User Experience:**
- Smooth animations and transitions
- Professional enterprise appearance
- Responsive design
- Print-ready layouts
- Accessible components

---

## Next Steps

1. **Test with Different Workflows**
   - Create recruitment workflow
   - Create security incident workflow
   - Test generic fallback template

2. **Customize Reports**
   - Add custom templates
   - Modify existing templates
   - Customize branding

3. **Enhance Features**
   - Add chart generation
   - Implement email reports
   - Add report caching
   - Create report history

---

## Support

If you encounter issues:

1. **Check Logs**
   - Backend: Console output or `backend.log`
   - Frontend: Browser console (F12)

2. **Verify Installation**
   ```bash
   python -c "import reportlab; print('OK')"
   ```

3. **Test API Directly**
   ```bash
   # Test report endpoint
   curl http://localhost:8000/api/executions/1/report

   # Test PDF endpoint
   curl -X POST http://localhost:8000/api/executions/1/generate-pdf --output test.pdf
   ```

4. **Review Documentation**
   - Read `ENTERPRISE_REPORT_GENERATOR.md`
   - Check code comments
   - Review API responses

---

**Ready to generate enterprise reports!** 🎉

Start by running a workflow and clicking "View Enterprise Report" when it completes.
