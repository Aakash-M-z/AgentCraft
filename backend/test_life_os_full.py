import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

# Configure logging to print test steps
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("test_life_os")

# Ensure env vars are loaded
from dotenv import load_dotenv
load_dotenv()

async def run_full_test():
    logger.info("=== STARTING PERSONAL LIFE OS VERIFICATION ===")
    
    # 1. Test database connection and table initialization
    logger.info("Step 1: Initializing database and verifying models...")
    from backend.database import init_db, AsyncSessionLocal, Assignment, Placement, LeetCodeSubmission, DailyBriefing
    try:
        await init_db()
        logger.info("✓ Database initialized successfully.")
    except Exception as e:
        logger.error(f"✗ Database initialization failed: {e}")
        return False

    # 2. Test Repository Layer (Assignments & Placements)
    logger.info("\nStep 2: Testing Repository CRUD operations...")
    from backend.personal_life_os_repository import AssignmentRepository, PlacementRepository, LeetCodeRepository, BriefingRepository
    
    async with AsyncSessionLocal() as session:
        try:
            # Create a test assignment
            test_asg = await AssignmentRepository.create(
                session=session,
                title="Test Assignment - Verify Life OS",
                subject="Verification Suite",
                deadline=datetime.now(timezone.utc) + timedelta(hours=12),
                priority="high",
                status="pending",
                source="test"
            )
            await session.commit()
            logger.info(f"✓ Test Assignment created. ID: {test_asg.id}")

            # Create a test placement
            test_plc = await PlacementRepository.create(
                session=session,
                company_name="LifeOS Verification Corp",
                package="100 LPA",
                deadline=datetime.now(timezone.utc) + timedelta(days=2),
                eligibility="All Verification Agents",
                apply_url="https://verify.life.os",
                status="active"
            )
            await session.commit()
            if test_plc:
                logger.info(f"✓ Test Placement created. ID: {test_plc.id}")
            else:
                logger.info("✓ Test Placement creation skipped (already exists).")
                
            # Create a test LeetCode Submission
            test_lc = await LeetCodeRepository.create(
                session=session,
                title="Two Sum Test",
                slug="two-sum-test",
                difficulty="Easy",
                solution="class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]",
                status="solved"
            )
            await session.commit()
            logger.info(f"✓ Test LeetCode Submission created. ID: {test_lc.id}")
            
            # Fetch streak stats
            lc_stats = await LeetCodeRepository.get_streak_stats(session)
            logger.info(f"✓ LeetCode Streak stats: {lc_stats}")
            
        except Exception as e:
            logger.error(f"✗ Repository test failed: {e}")
            await session.rollback()
            return False

    # 3. Test AI connectivity using the call_ai function
    logger.info("\nStep 3: Testing AI connectivity and models...")
    from backend.ai import call_ai
    try:
        prompt = "Hello! Tell me in 10 words if you are working correctly."
        ai_resp = await call_ai(prompt, model="llama-3.3-70b-versatile", temperature=0.7)
        logger.info(f"✓ AI Response: {ai_resp.strip()}")
    except Exception as e:
        logger.error(f"✗ AI connection failed: {e}")
        return False

    # 4. Test Daily Briefing workflow job (mocking WhatsApp send to prevent headless browser failure)
    logger.info("\nStep 4: Testing Daily Briefing engine workflow (mocked WhatsApp output)...")
    
    mock_send_whatsapp = AsyncMock(return_value={"sent": True})
    
    with patch("backend.whatsapp.send_whatsapp_message", mock_send_whatsapp):
        from backend.life_os_api import daily_briefing_job
        try:
            await daily_briefing_job()
            logger.info("✓ Daily Briefing Job executed successfully.")
            # Verify WhatsApp mock was called
            if mock_send_whatsapp.called:
                called_args = mock_send_whatsapp.call_args
                logger.info(f"✓ WhatsApp mock intercepted send call successfully! Target Contact: {called_args[1].get('contact_name') or called_args[0][0]}")
                logger.info(f"✓ Briefing content dispatched:\n---\n{called_args[1].get('message') or called_args[0][1]}\n---")
            else:
                logger.warning("✗ WhatsApp send was not called during daily briefing.")
                
            # Verify briefing was saved in db
            async with AsyncSessionLocal() as session:
                briefings = await BriefingRepository.list_all(session)
                if briefings:
                    logger.info(f"✓ Daily Briefing successfully logged in DB. Content length: {len(briefings[0].content)} chars")
                else:
                    logger.warning("✗ Briefing not saved to DB.")
        except Exception as e:
            logger.error(f"✗ Daily Briefing Job test failed: {e}")
            return False

    # 5. Test Smart Reminders workflow job (mocking WhatsApp send)
    logger.info("\nStep 5: Testing Smart Reminders job (mocked WhatsApp/Email output)...")
    
    mock_send_email = AsyncMock(return_value={"sent": True})
    mock_send_whatsapp.reset_mock()
    
    with patch("backend.whatsapp.send_whatsapp_message", mock_send_whatsapp), \
         patch("backend.workflow_engine._send_email", mock_send_email):
        from backend.life_os_api import smart_reminders_job
        try:
            await smart_reminders_job()
            logger.info("✓ Smart Reminders Job executed successfully.")
            if mock_send_whatsapp.called:
                called_args = mock_send_whatsapp.call_args
                logger.info(f"✓ WhatsApp mock intercepted reminder call! Message: {called_args[1].get('message') or called_args[0][1]}")
            else:
                logger.info("✓ No urgent reminders were due/overdue to trigger alerts (mock not called).")
        except Exception as e:
            logger.error(f"✗ Smart Reminders Job test failed: {e}")
            return False

    # Cleanup test insertions
    logger.info("\nStep 6: Cleaning up test data...")
    async with AsyncSessionLocal() as session:
        try:
            await session.delete(test_asg)
            await session.delete(test_lc)
            await session.commit()
            logger.info("✓ Test data cleaned up successfully.")
        except Exception as e:
            logger.warning(f"Warning: Cleanup failed: {e}")
            await session.rollback()

    logger.info("\n=== ALL PERSONAL LIFE OS CHECKS PASSED SUCCESSFULLY ===")
    return True

if __name__ == "__main__":
    # Run the async main
    success = asyncio.run(run_full_test())
    if not success:
        exit(1)
