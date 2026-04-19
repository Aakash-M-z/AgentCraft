#!/bin/bash

# AgentCraft Production Deployment Script
# This script helps verify and deploy the application

set -e

echo "🚀 AgentCraft Production Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo -e "${RED}❌ Error: backend/main.py not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo -e "${GREEN}✅ Project structure verified${NC}"
echo ""

# Check environment files
echo "📋 Checking environment configuration..."
echo ""

if [ -f "artifacts/agentcraft/.env.production" ]; then
    echo -e "${GREEN}✅ Frontend .env.production exists${NC}"
    echo "   Content:"
    cat artifacts/agentcraft/.env.production | sed 's/^/   /'
else
    echo -e "${RED}❌ Frontend .env.production missing${NC}"
    exit 1
fi

echo ""

if [ -f ".env" ]; then
    echo -e "${GREEN}✅ Backend .env exists${NC}"
    echo "   (Not showing content for security)"
else
    echo -e "${YELLOW}⚠️  Backend .env missing (OK if using Render dashboard)${NC}"
fi

echo ""
echo "🔍 Verifying critical fixes..."
echo ""

# Check main.tsx uses VITE_API_URL
if grep -q "VITE_API_URL" artifacts/agentcraft/src/main.tsx; then
    echo -e "${GREEN}✅ Frontend uses VITE_API_URL${NC}"
else
    echo -e "${RED}❌ Frontend not using VITE_API_URL${NC}"
    exit 1
fi

# Check backend has error handling
if grep -q "Failed to create workflow" backend/main.py; then
    echo -e "${GREEN}✅ Backend has error handling${NC}"
else
    echo -e "${RED}❌ Backend missing error handling${NC}"
    exit 1
fi

# Check database SSL config
if grep -q 'ssl="require"' backend/database.py; then
    echo -e "${GREEN}✅ Database SSL configured${NC}"
else
    echo -e "${RED}❌ Database SSL not configured${NC}"
    exit 1
fi

# Check CORS
if grep -q 'allow_origins=\["\\*"\]' backend/main.py; then
    echo -e "${GREEN}✅ CORS configured${NC}"
else
    echo -e "${RED}❌ CORS not configured${NC}"
    exit 1
fi

# Check SSE completion event
if grep -q "execution_complete" backend/main.py; then
    echo -e "${GREEN}✅ SSE completion event implemented${NC}"
else
    echo -e "${RED}❌ SSE completion event missing${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All critical fixes verified!${NC}"
echo ""

# Git status
echo "📦 Git Status:"
echo ""
git status --short

echo ""
echo "🚀 Ready to Deploy!"
echo ""
echo "Next steps:"
echo "1. Commit and push changes:"
echo "   ${YELLOW}git add .${NC}"
echo "   ${YELLOW}git commit -m 'Production fixes: API config, error handling, SSE'${NC}"
echo "   ${YELLOW}git push origin main${NC}"
echo ""
echo "2. Verify Render environment variables:"
echo "   - DATABASE_URL"
echo "   - GROQ_API_KEY"
echo "   - EMAIL_USER"
echo "   - EMAIL_PASS"
echo ""
echo "3. Verify Vercel environment variable:"
echo "   - ${YELLOW}VITE_API_URL=https://agentcraft-kexf.onrender.com${NC}"
echo ""
echo "4. Redeploy Vercel if you changed the environment variable"
echo ""
echo "5. Test the deployment:"
echo "   - Create workflow → Save → Run"
echo "   - Verify logs stream in real-time"
echo "   - Verify output appears automatically"
echo ""
echo "📖 See PRODUCTION_DEBUG_CHECKLIST.md for detailed instructions"
echo ""
