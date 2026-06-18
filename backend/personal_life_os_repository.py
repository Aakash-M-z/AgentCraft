"""
Personal Life OS - Repository Layer.
Handles advanced database querying, duplicate prevention, and streak telemetry.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, date, timedelta

from sqlalchemy import select, update, delete, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from .database import Assignment, Placement, LeetCodeSubmission, DailyBriefing

logger = logging.getLogger(__name__)


# ── Assignment Repository ───────────────────────────────────────────────────

class AssignmentRepository:
    """Handles assignment tracking operations in the database."""

    @staticmethod
    async def create(
        session: AsyncSession,
        title: str,
        subject: str,
        deadline: datetime,
        priority: str = "medium",
        status: str = "pending",
        source: str = "manual"
    ) -> Assignment:
        """Create a new academic/work assignment."""
        assignment = Assignment(
            title=title.strip(),
            subject=subject.strip(),
            deadline=deadline,
            priority=priority,
            status=status,
            source=source
        )
        session.add(assignment)
        await session.flush()
        await session.refresh(assignment)
        logger.info("Created assignment id=%d title=%s", assignment.id, assignment.title)
        return assignment

    @staticmethod
    async def get_by_id(session: AsyncSession, assignment_id: int) -> Optional[Assignment]:
        """Get assignment details by ID."""
        result = await session.execute(
            select(Assignment).where(Assignment.id == assignment_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(session: AsyncSession) -> List[Assignment]:
        """List all assignments ordered by deadline."""
        await AssignmentRepository.check_overdue_and_update(session)
        result = await session.execute(
            select(Assignment).order_by(Assignment.deadline.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def list_active(session: AsyncSession) -> List[Assignment]:
        """List pending/in_progress/overdue assignments."""
        await AssignmentRepository.check_overdue_and_update(session)
        result = await session.execute(
            select(Assignment)
            .where(Assignment.status != "completed")
            .order_by(Assignment.deadline.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def update(
        session: AsyncSession,
        assignment_id: int,
        title: Optional[str] = None,
        subject: Optional[str] = None,
        deadline: Optional[datetime] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None
    ) -> Optional[Assignment]:
        """Update assignment fields."""
        assignment = await AssignmentRepository.get_by_id(session, assignment_id)
        if not assignment:
            return None

        if title is not None:
            assignment.title = title.strip()
        if subject is not None:
            assignment.subject = subject.strip()
        if deadline is not None:
            assignment.deadline = deadline
        if priority is not None:
            assignment.priority = priority
        if status is not None:
            assignment.status = status

        assignment.updated_at = datetime.now(timezone.utc)
        await session.flush()
        await session.refresh(assignment)
        logger.info("Updated assignment id=%d", assignment_id)
        return assignment

    @staticmethod
    async def delete(session: AsyncSession, assignment_id: int) -> bool:
        """Delete assignment by ID."""
        result = await session.execute(
            delete(Assignment).where(Assignment.id == assignment_id)
        )
        return result.rowcount > 0

    @staticmethod
    async def check_overdue_and_update(session: AsyncSession) -> int:
        """Automatic check to mark active assignments overdue if deadline passed."""
        now = datetime.now(timezone.utc)
        result = await session.execute(
            select(Assignment).where(
                and_(
                    Assignment.status != "completed",
                    Assignment.status != "overdue",
                    Assignment.deadline < now
                )
            )
        )
        overdue_list = result.scalars().all()
        count = 0
        for task in overdue_list:
            task.status = "overdue"
            task.updated_at = now
            count += 1
        if count > 0:
            await session.flush()
            logger.info("Marked %d assignments as overdue", count)
        return count


# ── Placement Repository ─────────────────────────────────────────────────────

class PlacementRepository:
    """Handles career placement pipeline operations."""

    @staticmethod
    async def create(
        session: AsyncSession,
        company_name: str,
        package: Optional[str],
        deadline: datetime,
        eligibility: Optional[str] = None,
        apply_url: Optional[str] = None,
        status: str = "active"
    ) -> Optional[Placement]:
        """Create a new placement opportunity, preventing duplicate additions."""
        is_duplicate = await PlacementRepository.check_exists(session, company_name, deadline)
        if is_duplicate:
            logger.warning("Prevented duplicate placement opportunity: %s", company_name)
            return None

        placement = Placement(
            company_name=company_name.strip(),
            package=package.strip() if package else None,
            deadline=deadline,
            eligibility=eligibility,
            apply_url=apply_url,
            status=status
        )
        session.add(placement)
        await session.flush()
        await session.refresh(placement)
        logger.info("Created placement id=%d company=%s", placement.id, placement.company_name)
        return placement

    @staticmethod
    async def get_by_id(session: AsyncSession, placement_id: int) -> Optional[Placement]:
        """Get placement by ID."""
        result = await session.execute(
            select(Placement).where(Placement.id == placement_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(session: AsyncSession) -> List[Placement]:
        """List all placement opportunities."""
        await PlacementRepository.check_expired_and_update(session)
        result = await session.execute(
            select(Placement).order_by(Placement.deadline.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def list_active(session: AsyncSession) -> List[Placement]:
        """List active placements where deadline is in future."""
        await PlacementRepository.check_expired_and_update(session)
        result = await session.execute(
            select(Placement)
            .where(Placement.status == "active")
            .order_by(Placement.deadline.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def update(
        session: AsyncSession,
        placement_id: int,
        company_name: Optional[str] = None,
        package: Optional[str] = None,
        deadline: Optional[datetime] = None,
        eligibility: Optional[str] = None,
        apply_url: Optional[str] = None,
        status: Optional[str] = None
    ) -> Optional[Placement]:
        """Update placement fields."""
        placement = await PlacementRepository.get_by_id(session, placement_id)
        if not placement:
            return None

        if company_name is not None:
            placement.company_name = company_name.strip()
        if package is not None:
            placement.package = package.strip()
        if deadline is not None:
            placement.deadline = deadline
        if eligibility is not None:
            placement.eligibility = eligibility
        if apply_url is not None:
            placement.apply_url = apply_url
        if status is not None:
            placement.status = status

        placement.updated_at = datetime.now(timezone.utc)
        await session.flush()
        await session.refresh(placement)
        logger.info("Updated placement id=%d", placement_id)
        return placement

    @staticmethod
    async def delete(session: AsyncSession, placement_id: int) -> bool:
        """Delete placement opportunity."""
        result = await session.execute(
            delete(Placement).where(Placement.id == placement_id)
        )
        return result.rowcount > 0

    @staticmethod
    async def check_exists(session: AsyncSession, company_name: str, deadline: datetime) -> bool:
        """Verify if a placement for this company and deadline already exists to avoid duplication."""
        # Simple duplicate extraction filter (name match + close deadline within 24h)
        delta_day = timedelta(days=1)
        result = await session.execute(
            select(Placement).where(
                and_(
                    Placement.company_name.ilike(company_name.strip()),
                    Placement.deadline >= deadline - delta_day,
                    Placement.deadline <= deadline + delta_day
                )
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def check_expired_and_update(session: AsyncSession) -> int:
        """Set active placements to 'expired' status if deadline passed."""
        now = datetime.now(timezone.utc)
        result = await session.execute(
            select(Placement).where(
                and_(
                    Placement.status == "active",
                    Placement.deadline < now
                )
            )
        )
        expired_list = result.scalars().all()
        count = 0
        for pl in expired_list:
            pl.status = "expired"
            pl.updated_at = now
            count += 1
        if count > 0:
            await session.flush()
            logger.info("Marked %d placements as expired", count)
        return count


# ── LeetCode Repository ──────────────────────────────────────────────────────

class LeetCodeRepository:
    """Handles LeetCode solvers database integrations."""

    @staticmethod
    async def create(
        session: AsyncSession,
        title: str,
        slug: str,
        difficulty: str,
        solution: str,
        status: str = "solved"
    ) -> LeetCodeSubmission:
        """Record LeetCode daily solve submission."""
        submission = LeetCodeSubmission(
            title=title.strip(),
            slug=slug.strip(),
            difficulty=difficulty,
            solution=solution,
            status=status
        )
        session.add(submission)
        await session.flush()
        await session.refresh(submission)
        logger.info("Saved LeetCode solve id=%d title=%s", submission.id, submission.title)
        return submission

    @staticmethod
    async def list_all(session: AsyncSession) -> List[LeetCodeSubmission]:
        """List all LeetCode solved submissions."""
        result = await session.execute(
            select(LeetCodeSubmission).order_by(LeetCodeSubmission.date.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_streak_stats(session: AsyncSession) -> Dict[str, Any]:
        """Retrieve total solves, solves by difficulty level, and current daily streak."""
        submissions = await LeetCodeRepository.list_all(session)
        
        total_solved = len([s for s in submissions if s.status == "solved"])
        easy_count = len([s for s in submissions if s.difficulty.lower() == "easy"])
        medium_count = len([s for s in submissions if s.difficulty.lower() == "medium"])
        hard_count = len([s for s in submissions if s.difficulty.lower() == "hard"])
        
        # Calculate daily solving streak (consecutive calendar dates)
        solved_dates = sorted(
            list({s.date.astimezone(timezone.utc).date() for s in submissions if s.status == "solved"}),
            reverse=True
        )
        
        current_streak = 0
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        
        # Streak continues if they solved today OR yesterday
        if solved_dates:
            latest_date = solved_dates[0]
            if latest_date == today or latest_date == yesterday:
                current_streak = 1
                expected_date = latest_date - timedelta(days=1)
                for d in solved_dates[1:]:
                    if d == expected_date:
                        current_streak += 1
                        expected_date -= timedelta(days=1)
                    else:
                        break
        
        return {
            "totalSolved": total_solved,
            "easy": easy_count,
            "medium": medium_count,
            "hard": hard_count,
            "streak": current_streak,
            "missedCount": len([s for s in submissions if s.status == "missed"])
        }


# ── Daily Briefing Repository ─────────────────────────────────────────────────

class BriefingRepository:
    """Handles daily briefings archives logging."""

    @staticmethod
    async def create(
        session: AsyncSession,
        content: str,
        status: str = "sent"
    ) -> DailyBriefing:
        """Archive a generated briefing summary."""
        briefing = DailyBriefing(
            content=content,
            status=status
        )
        session.add(briefing)
        await session.flush()
        await session.refresh(briefing)
        logger.info("Saved daily briefing log id=%d", briefing.id)
        return briefing

    @staticmethod
    async def list_all(session: AsyncSession) -> List[DailyBriefing]:
        """List past briefings logs."""
        result = await session.execute(
            select(DailyBriefing).order_by(DailyBriefing.created_at.desc())
        )
        return list(result.scalars().all())
