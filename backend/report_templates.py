"""
Report Templates Registry
Defines report templates for different workflow types.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional


@dataclass
class ReportSection:
    """Defines a section in the report"""
    title: str
    type: str  # 'table', 'list', 'keyvalue', 'text'
    data_key: Optional[str] = None
    required: bool = True


@dataclass
class ChartConfig:
    """Defines a chart configuration"""
    type: str  # 'pie', 'bar', 'line', 'gauge'
    title: str
    data_key: str


@dataclass
class ReportTemplate:
    """Report template definition"""
    id: str
    name: str
    workflow_types: List[str]
    sections: List[ReportSection] = field(default_factory=list)
    charts: List[ChartConfig] = field(default_factory=list)
    layout: str = 'portrait'  # 'portrait' or 'landscape'


class TemplateRegistry:
    """Registry for report templates"""
    
    _templates: Dict[str, ReportTemplate] = {}
    
    @classmethod
    def register(cls, template: ReportTemplate):
        """Register a new template"""
        for workflow_type in template.workflow_types:
            cls._templates[workflow_type.lower()] = template
    
    @classmethod
    def get_template(cls, workflow_type: str) -> ReportTemplate:
        """Get template by workflow type, fallback to generic"""
        return cls._templates.get(workflow_type.lower(), cls._templates.get('generic'))
    
    @classmethod
    def list_templates(cls) -> List[ReportTemplate]:
        """List all registered templates"""
        return list(set(cls._templates.values()))


# ── Procurement Template ──────────────────────────────────────────────────────

procurement_template = ReportTemplate(
    id='procurement',
    name='Enterprise Procurement Report',
    workflow_types=['procurement', 'purchase', 'procurement_orchestrator'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Purchase Order Details', type='keyvalue', data_key='po_details'),
        ReportSection(title='Budget Analysis', type='keyvalue', data_key='budget_analysis'),
        ReportSection(title='Vendor Information', type='keyvalue', data_key='vendor_info'),
        ReportSection(title='Risk Assessment', type='keyvalue', data_key='risk_assessment'),
        ReportSection(title='Approval Timeline', type='list', data_key='approval_timeline'),
        ReportSection(title='Audit Trail', type='list', data_key='audit_trail'),
    ],
    charts=[
        ChartConfig(type='gauge', title='Risk Score', data_key='risk_score'),
        ChartConfig(type='pie', title='Budget Usage', data_key='budget_usage'),
    ],
    layout='portrait'
)

# ── Recruitment Template ──────────────────────────────────────────────────────

recruitment_template = ReportTemplate(
    id='recruitment',
    name='Candidate Assessment Report',
    workflow_types=['recruitment', 'hiring', 'candidate', 'hr'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Candidate Profile', type='keyvalue', data_key='candidate_profile'),
        ReportSection(title='Skills Assessment', type='table', data_key='skills_assessment'),
        ReportSection(title='Interview Feedback', type='list', data_key='interview_feedback'),
        ReportSection(title='Final Recommendation', type='text', data_key='recommendation'),
    ],
    charts=[
        ChartConfig(type='bar', title='Skills Evaluation', data_key='skills_chart'),
    ],
    layout='portrait'
)

# ── Cybersecurity Template ────────────────────────────────────────────────────

cybersecurity_template = ReportTemplate(
    id='cybersecurity',
    name='Incident Investigation Report',
    workflow_types=['security', 'cybersecurity', 'incident', 'threat'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Incident Details', type='keyvalue', data_key='incident_details'),
        ReportSection(title='Threat Analysis', type='text', data_key='threat_analysis'),
        ReportSection(title='Affected Systems', type='list', data_key='affected_systems'),
        ReportSection(title='Mitigation Steps', type='list', data_key='mitigation_steps'),
        ReportSection(title='Recommendations', type='list', data_key='recommendations'),
    ],
    charts=[
        ChartConfig(type='gauge', title='Severity Level', data_key='severity_level'),
    ],
    layout='portrait'
)

# ── Generic Template ──────────────────────────────────────────────────────────

generic_template = ReportTemplate(
    id='generic',
    name='AI Workflow Report',
    workflow_types=['generic', 'default', 'unknown'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Workflow Details', type='keyvalue', data_key='workflow_details'),
        ReportSection(title='Results', type='text', data_key='results'),
        ReportSection(title='Key Findings', type='list', data_key='key_findings'),
    ],
    charts=[],
    layout='portrait'
)

# ── Email Template ────────────────────────────────────────────────────────────

email_template = ReportTemplate(
    id='email',
    name='Email Delivery Report',
    workflow_types=['email', 'notification', 'message'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Delivery Details', type='keyvalue', data_key='delivery_details'),
        ReportSection(title='Recipients', type='list', data_key='recipients'),
        ReportSection(title='Status', type='text', data_key='status'),
    ],
    charts=[],
    layout='portrait'
)

# ── GitHub Template ───────────────────────────────────────────────────────────

github_template = ReportTemplate(
    id='github',
    name='Developer Activity Report',
    workflow_types=['github', 'git', 'developer', 'code'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Repository Activity', type='keyvalue', data_key='repo_activity'),
        ReportSection(title='Commits', type='list', data_key='commits'),
        ReportSection(title='Pull Requests', type='list', data_key='pull_requests'),
    ],
    charts=[
        ChartConfig(type='bar', title='Activity Timeline', data_key='activity_chart'),
    ],
    layout='portrait'
)

# ── Weather Template ──────────────────────────────────────────────────────────

weather_template = ReportTemplate(
    id='weather',
    name='Daily Weather Brief',
    workflow_types=['weather', 'forecast', 'climate'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Current Conditions', type='keyvalue', data_key='current_conditions'),
        ReportSection(title='Forecast', type='list', data_key='forecast'),
    ],
    charts=[],
    layout='portrait'
)

# ── LeetCode Template ─────────────────────────────────────────────────────────

leetcode_template = ReportTemplate(
    id='leetcode',
    name='Coding Challenge Report',
    workflow_types=['leetcode', 'coding', 'algorithm'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Problem Details', type='keyvalue', data_key='problem_details'),
        ReportSection(title='Solution', type='text', data_key='solution'),
        ReportSection(title='Complexity Analysis', type='keyvalue', data_key='complexity'),
    ],
    charts=[],
    layout='portrait'
)

# ── Meeting Template ──────────────────────────────────────────────────────────

meeting_template = ReportTemplate(
    id='meeting',
    name='Meeting Minutes',
    workflow_types=['meeting', 'conference', 'discussion'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Meeting Details', type='keyvalue', data_key='meeting_details'),
        ReportSection(title='Attendees', type='list', data_key='attendees'),
        ReportSection(title='Agenda Items', type='list', data_key='agenda'),
        ReportSection(title='Action Items', type='list', data_key='action_items'),
    ],
    charts=[],
    layout='portrait'
)

# ── Customer Support Template ─────────────────────────────────────────────────

support_template = ReportTemplate(
    id='support',
    name='Support Resolution Report',
    workflow_types=['support', 'customer', 'ticket', 'helpdesk'],
    sections=[
        ReportSection(title='Executive Summary', type='text', data_key='executive_summary'),
        ReportSection(title='Ticket Details', type='keyvalue', data_key='ticket_details'),
        ReportSection(title='Resolution Steps', type='list', data_key='resolution_steps'),
        ReportSection(title='Customer Feedback', type='text', data_key='feedback'),
    ],
    charts=[],
    layout='portrait'
)


# ── Register All Templates ────────────────────────────────────────────────────

def init_templates():
    """Initialize and register all templates"""
    TemplateRegistry.register(procurement_template)
    TemplateRegistry.register(recruitment_template)
    TemplateRegistry.register(cybersecurity_template)
    TemplateRegistry.register(email_template)
    TemplateRegistry.register(github_template)
    TemplateRegistry.register(weather_template)
    TemplateRegistry.register(leetcode_template)
    TemplateRegistry.register(meeting_template)
    TemplateRegistry.register(support_template)
    TemplateRegistry.register(generic_template)


# Initialize on import
init_templates()
