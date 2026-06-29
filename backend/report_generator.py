"""
Report Generator Service
Generates professional enterprise reports from workflow execution data.
"""
import json
import logging
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from .ai import call_ai
from .report_templates import TemplateRegistry, ReportTemplate

logger = logging.getLogger(__name__)


class ReportGeneratorService:
    """Service for generating enterprise reports"""
    
    @staticmethod
    def _compute_fingerprint(execution_data: Dict[str, Any]) -> str:
        """Generate a unique digital fingerprint for the report"""
        data_str = json.dumps(execution_data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()[:16].upper()
    
    @staticmethod
    def _detect_workflow_type(workflow_name: str, nodes: List[Dict[str, Any]]) -> str:
        """
        Automatically detect workflow type based on name and nodes.
        Returns workflow type string (lowercase).
        """
        name_lower = workflow_name.lower()
        
        # Check workflow name for keywords
        if any(kw in name_lower for kw in ['procurement', 'purchase', 'po', 'vendor']):
            return 'procurement'
        elif any(kw in name_lower for kw in ['recruitment', 'hiring', 'candidate', 'hr']):
            return 'recruitment'
        elif any(kw in name_lower for kw in ['security', 'cybersecurity', 'incident', 'threat']):
            return 'cybersecurity'
        elif any(kw in name_lower for kw in ['email', 'notification', 'message']):
            return 'email'
        elif any(kw in name_lower for kw in ['github', 'git', 'developer', 'repository']):
            return 'github'
        elif any(kw in name_lower for kw in ['weather', 'forecast', 'climate']):
            return 'weather'
        elif any(kw in name_lower for kw in ['leetcode', 'coding', 'algorithm']):
            return 'leetcode'
        elif any(kw in name_lower for kw in ['meeting', 'conference', 'discussion']):
            return 'meeting'
        elif any(kw in name_lower for kw in ['support', 'customer', 'ticket', 'helpdesk']):
            return 'support'
        
        # Check node types for clues
        node_types = {node.get('type', '').lower() for node in nodes}
        
        if any('procurement' in nt for nt in node_types):
            return 'procurement'
        elif any('recruit' in nt for nt in node_types):
            return 'recruitment'
        elif 'leetcode' in node_types:
            return 'leetcode'
        elif 'email' in node_types:
            return 'email'
        elif 'github' in node_types:
            return 'github'
        elif 'weather' in node_types:
            return 'weather'
        
        return 'generic'
    
    @staticmethod
    async def _generate_executive_summary(
        workflow_type: str,
        workflow_name: str,
        execution_data: Dict[str, Any],
        final_output: str
    ) -> Dict[str, str]:
        """
        Generate AI-powered executive summary in professional business language.
        Returns dict with: businessPurpose, keyFindings, riskAssessment, recommendation, finalDecision
        """
        prompt = f"""You are an enterprise report writer. Generate a professional executive summary for this workflow execution.

Workflow Type: {workflow_type.title()}
Workflow Name: {workflow_name}
Execution Status: {execution_data.get('status', 'completed')}

Execution Data:
{json.dumps(execution_data, indent=2)[:2000]}

Final Output:
{final_output[:1000]}

Generate a concise, professional executive summary in business language. Return ONLY valid JSON (no markdown) with this structure:
{{
  "businessPurpose": "One sentence explaining the business purpose of this workflow",
  "keyFindings": "2-3 sentence summary of key findings and results",
  "riskAssessment": "1-2 sentence risk assessment (High/Medium/Low with brief justification)",
  "recommendation": "1-2 sentence recommendation for action",
  "finalDecision": "One sentence final decision or outcome (e.g. 'Approved for processing', 'Requires manual review', 'Completed successfully')"
}}

Keep it concise and professional. Avoid technical jargon. Write as if for executives or business stakeholders."""

        try:
            response = await call_ai(prompt, model="llama-3.3-70b-versatile", temperature=0.3)
            
            # Try to parse JSON
            response_clean = response.strip()
            if response_clean.startswith('```'):
                # Remove markdown fences
                lines = response_clean.split('\n')
                response_clean = '\n'.join(lines[1:-1]) if len(lines) > 2 else response_clean
            
            summary_data = json.loads(response_clean)
            
            return {
                'businessPurpose': summary_data.get('businessPurpose', 'Automated workflow execution'),
                'keyFindings': summary_data.get('keyFindings', 'Workflow completed successfully.'),
                'riskAssessment': summary_data.get('riskAssessment', 'Low risk: Standard execution'),
                'recommendation': summary_data.get('recommendation', 'Proceed with normal operations.'),
                'finalDecision': summary_data.get('finalDecision', 'Approved')
            }
        except Exception as e:
            logger.error(f"Failed to generate AI executive summary: {e}")
            # Fallback summary
            return {
                'businessPurpose': f"Automated {workflow_type} workflow execution",
                'keyFindings': f"Workflow completed with status: {execution_data.get('status', 'completed')}",
                'riskAssessment': 'Low risk: Standard automated execution',
                'recommendation': 'Workflow executed successfully according to defined parameters.',
                'finalDecision': 'Completed' if execution_data.get('status') == 'completed' else 'Review Required'
            }
    
    @staticmethod
    def _extract_metrics(
        workflow_type: str,
        execution_data: Dict[str, Any],
        final_output: str
    ) -> List[Dict[str, Any]]:
        """Extract key metrics for dashboard display"""
        metrics = []
        
        # Common metrics for all workflows
        metrics.append({
            'key': 'Status',
            'value': execution_data.get('status', 'completed').title(),
            'badge': 'success' if execution_data.get('status') == 'completed' else 'error',
            'icon': 'CheckCircle' if execution_data.get('status') == 'completed' else 'XCircle'
        })
        
        # Calculate duration
        if execution_data.get('createdAt') and execution_data.get('updatedAt'):
            try:
                created = datetime.fromisoformat(execution_data['createdAt'].replace('Z', '+00:00'))
                updated = datetime.fromisoformat(execution_data['updatedAt'].replace('Z', '+00:00'))
                duration = (updated - created).total_seconds()
                metrics.append({
                    'key': 'Execution Time',
                    'value': f"{duration:.2f}s",
                    'badge': 'info',
                    'icon': 'Clock'
                })
            except:
                pass
        
        # Workflow-specific metrics
        if workflow_type == 'procurement':
            # Try to extract procurement-specific data from node results or output
            try:
                output_data = json.loads(final_output) if isinstance(final_output, str) else final_output
                if isinstance(output_data, dict):
                    if 'purchaseOrder' in output_data:
                        metrics.append({
                            'key': 'Purchase Order',
                            'value': output_data['purchaseOrder'],
                            'badge': 'info',
                            'icon': 'FileText'
                        })
                    if 'risk' in output_data:
                        metrics.append({
                            'key': 'Risk Level',
                            'value': output_data['risk'].title(),
                            'badge': 'success' if output_data['risk'].lower() == 'low' else 'warning',
                            'icon': 'AlertTriangle'
                        })
                    if 'vendor' in output_data:
                        metrics.append({
                            'key': 'Vendor',
                            'value': output_data['vendor'],
                            'badge': 'info',
                            'icon': 'Building'
                        })
            except:
                pass
        
        # Node count
        node_results = execution_data.get('nodeResults', [])
        if node_results:
            metrics.append({
                'key': 'Nodes Executed',
                'value': str(len(node_results)),
                'badge': 'info',
                'icon': 'Boxes'
            })
        
        return metrics
    
    @staticmethod
    def _extract_sections_data(
        workflow_type: str,
        execution_data: Dict[str, Any],
        final_output: str,
        template: ReportTemplate
    ) -> Dict[str, Any]:
        """Extract data for report sections based on template"""
        sections_data = {}
        
        # Try to parse final output as JSON
        try:
            output_data = json.loads(final_output) if isinstance(final_output, str) else final_output
        except:
            output_data = {'result': final_output}
        
        # Extract data for each section in template
        for section in template.sections:
            if section.data_key == 'executive_summary':
                # This will be filled in later by AI
                sections_data[section.data_key] = None
            elif section.data_key == 'workflow_details':
                sections_data[section.data_key] = {
                    'Workflow ID': execution_data.get('workflowId', 'N/A'),
                    'Execution ID': execution_data.get('id', 'N/A'),
                    'Status': execution_data.get('status', 'N/A').title(),
                    'Started': execution_data.get('createdAt', 'N/A'),
                    'Completed': execution_data.get('updatedAt', 'N/A'),
                }
            elif section.data_key == 'results':
                sections_data[section.data_key] = final_output[:2000]
            elif section.data_key == 'key_findings':
                # Extract from node results
                findings = []
                for nr in execution_data.get('nodeResults', []):
                    if nr.get('status') == 'success' and nr.get('output'):
                        findings.append(f"{nr.get('label', 'Node')}: Completed successfully")
                sections_data[section.data_key] = findings or ['Workflow executed without issues']
            elif section.data_key in output_data:
                sections_data[section.data_key] = output_data[section.data_key]
            else:
                # Try to extract from output_data
                sections_data[section.data_key] = output_data.get(section.data_key, {})
        
        return sections_data
    
    @staticmethod
    def _generate_audit_data(execution_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive audit trail data"""
        return {
            'executionId': execution_data.get('id', 'N/A'),
            'workflowId': execution_data.get('workflowId', 'N/A'),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'triggeredBy': 'System',  # TODO: Add user tracking
            'duration': 'N/A',  # Calculated elsewhere
            'nodeCount': len(execution_data.get('nodeResults', [])),
            'aiModel': 'llama-3.3-70b-versatile',  # TODO: Extract from execution
            'validationStatus': 'Passed' if execution_data.get('status') == 'completed' else 'Failed',
            'digitalFingerprint': ReportGeneratorService._compute_fingerprint(execution_data),
            'auditLog': execution_data.get('agentLogs', [])[-20:]  # Last 20 logs
        }
    
    @staticmethod
    async def generate_report(
        execution_id: int,
        workflow_id: int,
        workflow_name: str,
        workflow_nodes: List[Dict[str, Any]],
        execution_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate complete report data structure.
        
        Args:
            execution_id: Execution ID
            workflow_id: Workflow ID  
            workflow_name: Workflow name
            workflow_nodes: List of workflow nodes
            execution_data: Complete execution data with status, nodeResults, etc.
            
        Returns:
            Complete report data structure ready for frontend rendering
        """
        logger.info(f"Generating report for execution {execution_id}, workflow '{workflow_name}'")
        
        # Detect workflow type
        workflow_type = ReportGeneratorService._detect_workflow_type(workflow_name, workflow_nodes)
        logger.info(f"Detected workflow type: {workflow_type}")
        
        # Get appropriate template
        template = TemplateRegistry.get_template(workflow_type)
        logger.info(f"Using template: {template.name}")
        
        # Extract final output
        final_output = execution_data.get('finalOutput', '')
        
        # Generate AI executive summary
        executive_summary = await ReportGeneratorService._generate_executive_summary(
            workflow_type, workflow_name, execution_data, final_output
        )
        
        # Extract metrics for dashboard
        metrics = ReportGeneratorService._extract_metrics(workflow_type, execution_data, final_output)
        
        # Extract sections data
        sections_data = ReportGeneratorService._extract_sections_data(
            workflow_type, execution_data, final_output, template
        )
        
        # Override executive summary with AI-generated one
        sections_data['executive_summary'] = executive_summary
        
        # Generate audit data
        audit = ReportGeneratorService._generate_audit_data(execution_data)
        
        # Calculate duration
        if execution_data.get('createdAt') and execution_data.get('updatedAt'):
            try:
                created = datetime.fromisoformat(execution_data['createdAt'].replace('Z', '+00:00'))
                updated = datetime.fromisoformat(execution_data['updatedAt'].replace('Z', '+00:00'))
                duration = (updated - created).total_seconds()
                audit['duration'] = f"{duration:.2f}s"
            except:
                pass
        
        # Build complete report structure
        report_data = {
            'id': f"RPT-{execution_id}",
            'executionId': execution_id,
            'workflowId': workflow_id,
            'workflowName': workflow_name,
            'workflowType': workflow_type,
            'templateId': template.id,
            'templateName': template.name,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'executiveSummary': executive_summary,
            'metrics': metrics,
            'sections': sections_data,
            'charts': [],  # TODO: Generate chart data
            'audit': audit,
            'rawData': execution_data
        }
        
        logger.info(f"Report generated successfully for execution {execution_id}")
        return report_data
