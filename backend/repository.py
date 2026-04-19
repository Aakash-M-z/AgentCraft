"""
Repository layer for database operations.
Provides clean abstraction over SQLAlchemy queries.
"""
import logging
from typing import List, Optional
from datetime import datetime, timezone

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from .database import Workflow, Execution

logger = logging.getLogger(__name__)


# ── Workflow Repository ───────────────────────────────────────────────────────

class WorkflowRepository:
    """Handles all workflow database operations."""

    @staticmethod
    async def create(
        session: AsyncSession,
        name: str,
        description: Optional[str],
        nodes: list,
        edges: list,
    ) -> Workflow:
        """Create a new workflow."""
        workflow = Workflow(
            name=name,
            description=description,
            nodes=nodes,
            edges=edges,
        )
        session.add(workflow)
        await session.flush()
        await session.refresh(workflow)
        logger.info("Created workflow id=%d name=%s", workflow.id, workflow.name)
        return workflow

    @staticmethod
    async def get_by_id(session: AsyncSession, workflow_id: int) -> Optional[Workflow]:
        """Get workflow by ID."""
        result = await session.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(session: AsyncSession) -> List[Workflow]:
        """List all workflows ordered by creation date."""
        result = await session.execute(
            select(Workflow).order_by(Workflow.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def update(
        session: AsyncSession,
        workflow_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        nodes: Optional[list] = None,
        edges: Optional[list] = None,
    ) -> Optional[Workflow]:
        """Update workflow fields."""
        workflow = await WorkflowRepository.get_by_id(session, workflow_id)
        if not workflow:
            return None

        if name is not None:
            workflow.name = name
        if description is not None:
            workflow.description = description
        if nodes is not None:
            workflow.nodes = nodes
        if edges is not None:
            workflow.edges = edges

        workflow.updated_at = datetime.now(timezone.utc)
        await session.flush()
        await session.refresh(workflow)
        logger.info("Updated workflow id=%d", workflow_id)
        return workflow

    @staticmethod
    async def delete(session: AsyncSession, workflow_id: int) -> bool:
        """Delete workflow by ID."""
        result = await session.execute(
            delete(Workflow).where(Workflow.id == workflow_id)
        )
        deleted = result.rowcount > 0
        if deleted:
            logger.info("Deleted workflow id=%d", workflow_id)
        return deleted


# ── Execution Repository ──────────────────────────────────────────────────────

class ExecutionRepository:
    """Handles all execution database operations."""

    @staticmethod
    async def create(
        session: AsyncSession,
        workflow_id: int,
        input_text: str,
    ) -> Execution:
        """Create a new execution."""
        execution = Execution(
            workflow_id=workflow_id,
            status="pending",
            input=input_text,
            final_output=None,
            node_results=[],
            agent_logs=[],
        )
        session.add(execution)
        await session.flush()
        await session.refresh(execution)
        logger.info("Created execution id=%d for workflow=%d", execution.id, workflow_id)
        return execution

    @staticmethod
    async def get_by_id(session: AsyncSession, execution_id: int) -> Optional[Execution]:
        """Get execution by ID."""
        result = await session.execute(
            select(Execution).where(Execution.id == execution_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_by_workflow(
        session: AsyncSession,
        workflow_id: Optional[int] = None,
    ) -> List[Execution]:
        """List executions, optionally filtered by workflow."""
        query = select(Execution).order_by(Execution.created_at.desc())
        if workflow_id is not None:
            query = query.where(Execution.workflow_id == workflow_id)
        result = await session.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def update_status(
        session: AsyncSession,
        execution_id: int,
        status: str,
        final_output: Optional[str] = None,
        node_results: Optional[list] = None,
        agent_logs: Optional[list] = None,
    ) -> Optional[Execution]:
        """Update execution status and results."""
        execution = await ExecutionRepository.get_by_id(session, execution_id)
        if not execution:
            return None

        execution.status = status
        execution.updated_at = datetime.now(timezone.utc)

        if final_output is not None:
            execution.final_output = final_output
        if node_results is not None:
            execution.node_results = node_results
        if agent_logs is not None:
            execution.agent_logs = agent_logs

        await session.flush()
        await session.refresh(execution)
        logger.info("Updated execution id=%d status=%s", execution_id, status)
        return execution

    @staticmethod
    async def append_log(
        session: AsyncSession,
        execution_id: int,
        log_message: str,
    ) -> bool:
        """Append a log message to execution (for real-time logging)."""
        execution = await ExecutionRepository.get_by_id(session, execution_id)
        if not execution:
            return False

        if execution.agent_logs is None:
            execution.agent_logs = []

        execution.agent_logs.append(log_message)
        execution.updated_at = datetime.now(timezone.utc)
        await session.flush()
        return True

    @staticmethod
    async def cancel(session: AsyncSession, execution_id: int) -> Optional[Execution]:
        """Cancel an execution."""
        return await ExecutionRepository.update_status(
            session, execution_id, "cancelled"
        )
