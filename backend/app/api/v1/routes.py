import json
import asyncio
import httpx
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.db.models import TestRun, TestResult
from app.schemas.test_run import (
    TestRunCreateRequest,
    TestRunResponse,
    TestRunDetailResponse,
    TestResultResponse,
    ReportSummaryResponse,
    CategoryStat
)
from app.engine.runner import TestRunner

router = APIRouter()

@router.post("/testrun", response_model=TestRunResponse, status_code=201)
async def create_test_run(
    payload: TestRunCreateRequest,
    db: Session = Depends(get_db)
):
    spec_content = payload.spec_content
    if not spec_content and payload.spec_url:
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                resp = await client.get(payload.spec_url)
                if resp.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to fetch OpenAPI spec from {payload.spec_url}: status {resp.status_code}")
                spec_content = resp.text
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Error fetching OpenAPI spec: {str(exc)}")

    if not spec_content:
        raise HTTPException(status_code=400, detail="Either 'spec_content' or 'spec_url' must be provided.")

    # Create new TestRun record
    test_run = TestRun(
        target_base_url=payload.target_base_url,
        status="PENDING"
    )
    db.add(test_run)
    db.commit()
    db.refresh(test_run)

    # Launch execution task in the background
    asyncio.create_task(
        TestRunner.run_suite(
            test_run_id=test_run.id,
            target_base_url=payload.target_base_url,
            spec_content=spec_content,
            account_a=payload.account_a,
            account_b=payload.account_b
        )
    )

    return test_run


@router.get("/testruns/{test_run_id}", response_model=TestRunResponse)
def get_test_run(test_run_id: str, db: Session = Depends(get_db)):
    test_run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
    if not test_run:
        raise HTTPException(status_code=404, detail=f"Test run with ID '{test_run_id}' not found.")
    return test_run


@router.get("/testruns/{test_run_id}/results", response_model=List[TestResultResponse])
def get_test_run_results(
    test_run_id: str,
    status: Optional[str] = Query(None, description="Filter by status: PASS, FAIL, WARNING"),
    category: Optional[str] = Query(None, description="Filter by category"),
    severity: Optional[str] = Query(None, description="Filter by severity: CRITICAL, HIGH, MEDIUM, LOW"),
    endpoint: Optional[str] = Query(None, description="Filter by endpoint substring"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(TestResult).filter(TestResult.test_run_id == test_run_id)

    if status:
        query = query.filter(TestResult.status == status.upper())
    if category:
        query = query.filter(TestResult.test_category == category.upper())
    if severity:
        query = query.filter(TestResult.severity == severity.upper())
    if endpoint:
        query = query.filter(TestResult.endpoint_path.contains(endpoint))

    results = query.order_by(TestResult.created_at.asc()).offset(offset).limit(limit).all()

    # Parse JSON fields for response
    response_list = []
    for r in results:
        req_data = json.loads(r.request_data) if r.request_data else None
        resp_data = json.loads(r.response_data) if r.response_data else None
        reasons = json.loads(r.failure_reasons) if r.failure_reasons else None
        response_list.append(
            TestResultResponse(
                id=r.id,
                test_run_id=r.test_run_id,
                endpoint_path=r.endpoint_path,
                http_method=r.http_method,
                test_category=r.test_category,
                test_name=r.test_name,
                description=r.description,
                status=r.status,
                severity=r.severity,
                status_code_received=r.status_code_received,
                duration_ms=r.duration_ms,
                request_data=req_data,
                response_data=resp_data,
                failure_reasons=reasons,
                remediation_hint=r.remediation_hint,
                created_at=r.created_at
            )
        )
    return response_list


@router.get("/reports/{test_run_id}", response_model=ReportSummaryResponse)
def get_report_summary(test_run_id: str, db: Session = Depends(get_db)):
    test_run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
    if not test_run:
        raise HTTPException(status_code=404, detail=f"Test run with ID '{test_run_id}' not found.")

    results = db.query(TestResult).filter(TestResult.test_run_id == test_run_id).all()

    category_breakdown = {}
    severity_breakdown = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    top_findings = []

    for r in results:
        cat = r.test_category
        if cat not in category_breakdown:
            category_breakdown[cat] = CategoryStat()
        
        category_breakdown[cat].total += 1
        if r.status == "PASS":
            category_breakdown[cat].passed += 1
        elif r.status == "FAIL":
            category_breakdown[cat].failed += 1
            severity_breakdown[r.severity] = severity_breakdown.get(r.severity, 0) + 1
        else:
            category_breakdown[cat].warning += 1

        if r.status in ("FAIL", "WARNING") and len(top_findings) < 20:
            req_data = json.loads(r.request_data) if r.request_data else None
            resp_data = json.loads(r.response_data) if r.response_data else None
            reasons = json.loads(r.failure_reasons) if r.failure_reasons else None
            top_findings.append(
                TestResultResponse(
                    id=r.id,
                    test_run_id=r.test_run_id,
                    endpoint_path=r.endpoint_path,
                    http_method=r.http_method,
                    test_category=r.test_category,
                    test_name=r.test_name,
                    description=r.description,
                    status=r.status,
                    severity=r.severity,
                    status_code_received=r.status_code_received,
                    duration_ms=r.duration_ms,
                    request_data=req_data,
                    response_data=resp_data,
                    failure_reasons=reasons,
                    remediation_hint=r.remediation_hint,
                    created_at=r.created_at
                )
            )

    return ReportSummaryResponse(
        id=test_run.id,
        target_base_url=test_run.target_base_url,
        spec_title=test_run.spec_title,
        spec_version=test_run.spec_version,
        status=test_run.status,
        compliance_score=test_run.compliance_score,
        started_at=test_run.started_at,
        completed_at=test_run.completed_at,
        total_tests=test_run.total_tests,
        passed_tests=test_run.passed_tests,
        failed_tests=test_run.failed_tests,
        warning_tests=test_run.warning_tests,
        category_breakdown=category_breakdown,
        severity_breakdown=severity_breakdown,
        top_findings=top_findings
    )


@router.get("/reports/{test_run_id}/html")
def get_report_html(test_run_id: str, db: Session = Depends(get_db)):
    from fastapi.responses import HTMLResponse
    test_run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
    if not test_run:
        raise HTTPException(status_code=404, detail=f"Test run with ID '{test_run_id}' not found.")

    results = db.query(TestResult).filter(TestResult.test_run_id == test_run_id).all()

    findings_html = ""
    for r in results:
        if r.status in ("FAIL", "WARNING"):
            badge_color = "#E13B3B" if r.severity == "CRITICAL" else ("#F2994A" if r.severity == "HIGH" else "#F2C94C")
            reasons = json.loads(r.failure_reasons) if r.failure_reasons else []
            reasons_li = "".join([f"<li>{item}</li>" for item in reasons])
            
            req_data = json.loads(r.request_data) if r.request_data else {}
            resp_data = json.loads(r.response_data) if r.response_data else {}

            findings_html += f"""
            <div class="finding-card">
                <div class="finding-header">
                    <span class="badge" style="background: {badge_color}20; color: {badge_color}; border: 1px solid {badge_color}60;">
                        {r.severity}
                    </span>
                    <span class="category-tag">{r.test_category}</span>
                    <span class="endpoint-text"><strong>{r.http_method}</strong> {r.endpoint_path}</span>
                    <span class="status-badge" style="color: {badge_color};">{r.status}</span>
                </div>
                <div class="finding-body">
                    <p class="finding-desc">{r.description}</p>
                    {f'<ul class="reasons-list">{reasons_li}</ul>' if reasons_li else ''}
                    {f'<div class="remediation"><strong>Remediation:</strong> {r.remediation_hint}</div>' if r.remediation_hint else ''}
                    
                    <div class="code-grid">
                        <div class="code-block">
                            <div class="code-title">Request Snapshot</div>
                            <pre><code>{json.dumps(req_data, indent=2)}</code></pre>
                        </div>
                        <div class="code-block">
                            <div class="code-title">Response Snapshot (Status: {r.status_code_received or 'N/A'})</div>
                            <pre><code>{json.dumps(resp_data, indent=2)}</code></pre>
                        </div>
                    </div>
                </div>
            </div>
            """

    if not findings_html:
        findings_html = """
        <div class="clean-card">
            <h3 style="color: #3ED9A6; margin-bottom: 8px;">All Contract Tests Passed Successfully!</h3>
            <p style="color: #7C8DA6;">No contract discrepancies, schema drift, or multi-tenant data isolation issues were detected during this audit run.</p>
        </div>
        """

    score_color = "#3ED9A6" if test_run.compliance_score >= 80 else ("#F2994A" if test_run.compliance_score >= 50 else "#E13B3B")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>APISentry Audit Report — {test_run.spec_title or 'API'}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background-color: #090A0F;
            color: #FFFFFF;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 40px 24px;
            line-height: 1.5;
        }}
        .container {{ max-width: 1040px; margin: 0 auto; }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 24px;
            border-bottom: 1px solid #331E3D;
            margin-bottom: 32px;
        }}
        .logo-wrap {{ display: flex; align-items: center; gap: 12px; }}
        .logo-box {{
            width: 44px; height: 44px; border-radius: 10px;
            background: linear-gradient(135deg, #FF007F, #FF3399);
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 22px; color: white;
            box-shadow: 0 0 20px rgba(255, 0, 127, 0.5);
        }}
        .title-sub {{ color: #00F0FF; font-size: 13px; margin-top: 4px; }}
        .print-btn {{
            background: linear-gradient(135deg, #FF007F, #FF3399);
            color: white; border: none; padding: 10px 20px;
            border-radius: 8px; font-weight: 700; cursor: pointer;
            box-shadow: 0 0 15px rgba(255, 0, 127, 0.4);
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 32px;
        }}
        .stat-card {{
            background: #1B212B;
            border: 1px solid #2B3545;
            border-radius: 12px;
            padding: 20px;
        }}
        .stat-label {{ font-size: 12px; color: #7C8DA6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }}
        .stat-val {{ font-size: 32px; font-weight: 700; }}
        .finding-card {{
            background: #1B212B;
            border: 1px solid #2B3545;
            border-radius: 12px;
            margin-bottom: 20px;
            overflow: hidden;
        }}
        .finding-header {{
            background: #202734;
            padding: 14px 20px;
            display: flex;
            align-items: center;
            gap: 14px;
            border-bottom: 1px solid #2B3545;
        }}
        .badge {{
            padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
        }}
        .category-tag {{ color: #7C8DA6; font-size: 12px; font-family: monospace; }}
        .endpoint-text {{ font-family: monospace; font-size: 14px; flex-grow: 1; }}
        .finding-body {{ padding: 20px; }}
        .finding-desc {{ font-size: 14px; color: #CBD5E1; margin-bottom: 14px; }}
        .reasons-list {{ margin: 0 0 16px 20px; color: #F87171; font-size: 13px; }}
        .reasons-list li {{ margin-bottom: 4px; }}
        .remediation {{
            background: #151A22;
            border-left: 3px solid #2E7DFF;
            padding: 12px 16px;
            border-radius: 0 8px 8px 0;
            font-size: 13px;
            color: #94A3B8;
            margin-bottom: 16px;
        }}
        .code-grid {{
            display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
        }}
        .code-block {{
            background: #12161C;
            border: 1px solid #2B3545;
            border-radius: 8px;
            overflow: hidden;
        }}
        .code-title {{
            background: #1A212C;
            padding: 8px 12px;
            font-size: 11px;
            color: #7C8DA6;
            font-family: monospace;
            border-bottom: 1px solid #2B3545;
        }}
        pre {{ padding: 12px; font-family: "JetBrains Mono", Consolas, monospace; font-size: 11px; overflow-x: auto; color: #94A3B8; max-height: 250px; }}
        .clean-card {{
            background: #1B212B; border: 1px solid #2B3545; border-radius: 12px; padding: 32px; text-align: center;
        }}
        @media print {{
            body {{ background-color: white !important; color: black !important; padding: 0 !important; }}
            .print-btn {{ display: none !important; }}
            .stat-card, .finding-card {{ background: white !important; border-color: #CBD5E1 !important; color: black !important; }}
            .finding-header {{ background: #F8FAFC !important; border-color: #E2E8F0 !important; }}
            .code-block {{ background: #F8FAFC !important; border-color: #E2E8F0 !important; color: black !important; }}
            pre {{ color: #1E293B !important; }}
            .finding-desc {{ color: #334155 !important; }}
            .remediation {{ background: #F1F5F9 !important; color: #334155 !important; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo-wrap">
                <div class="logo-box">AS</div>
                <div>
                    <h1 style="font-size: 24px; font-weight: 750;">APISentry Security & Contract Audit</h1>
                    <div class="title-sub">Target: <code>{test_run.target_base_url}</code> &bull; Spec: <strong>{test_run.spec_title or 'OpenAPI Specification'}</strong> (v{test_run.spec_version or '1.0'})</div>
                </div>
            </div>
            <div>
                <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Compliance Score</div>
                <div class="stat-val" style="color: {score_color};">{test_run.compliance_score}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Tests Executed</div>
                <div class="stat-val">{test_run.total_tests}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Passed Tests</div>
                <div class="stat-val" style="color: #3ED9A6;">{test_run.passed_tests}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Failed / Warnings</div>
                <div class="stat-val" style="color: #E13B3B;">{test_run.failed_tests} <span style="font-size: 18px; color: #F2994A;">/ {test_run.warning_tests}</span></div>
            </div>
        </div>

        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #E2E8F0;">Audit Findings & Mismatches</h2>
        {findings_html}
    </div>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


@router.get("/history", response_model=List[TestRunResponse])
def get_test_history(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    runs = db.query(TestRun).order_by(desc(TestRun.started_at)).limit(limit).all()
    return runs

