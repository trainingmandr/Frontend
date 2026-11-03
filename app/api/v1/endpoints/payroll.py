from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import AdminUser, CurrentOrg, CurrentUser, DbSession, EditorUser, MonthPath
from app.models.payroll import PayrollSummary
from app.schemas.payroll import PayrollProcessResult, PayrollSummaryRead
from app.services.payroll import get_summary, lock_payroll, process_payroll, unlock_payroll

# Mounted at /orgs/{org_code}/payroll
router = APIRouter()


@router.get("", response_model=list[PayrollSummaryRead])
def list_payrolls(org: CurrentOrg, db: DbSession, _: CurrentUser) -> list[PayrollSummary]:
    """Payroll history, newest month first."""
    return list(
        db.scalars(
            select(PayrollSummary)
            .where(PayrollSummary.org_code == org.org_code)
            .order_by(PayrollSummary.month_year.desc())
        )
    )


@router.get("/{month_year}", response_model=PayrollSummaryRead)
def get_payroll(month_year: MonthPath, org: CurrentOrg, db: DbSession, _: CurrentUser) -> PayrollSummary:
    summary = get_summary(db, org.org_code, month_year)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Payroll for {month_year} has not been processed")
    return summary


@router.post("/{month_year}/process", response_model=PayrollProcessResult)
def process(month_year: MonthPath, org: CurrentOrg, db: DbSession, _: EditorUser) -> PayrollProcessResult:
    """Total the month's transactions into payroll_summary and mark it PROCESSED. Can be re-run until locked."""
    summary, lines, warnings = process_payroll(db, org, month_year)
    db.commit()
    db.refresh(summary)
    return PayrollProcessResult(
        summary=PayrollSummaryRead.model_validate(summary), employee_count=len(lines), warnings=warnings
    )


@router.post("/{month_year}/lock", response_model=PayrollSummaryRead)
def lock(month_year: MonthPath, org: CurrentOrg, db: DbSession, _: EditorUser) -> PayrollSummary:
    """Freeze the month: transactions can no longer be edited."""
    summary = lock_payroll(db, org.org_code, month_year)
    db.commit()
    db.refresh(summary)
    return summary


@router.post("/{month_year}/unlock", response_model=PayrollSummaryRead)
def unlock(month_year: MonthPath, org: CurrentOrg, db: DbSession, _: AdminUser) -> PayrollSummary:
    summary = unlock_payroll(db, org.org_code, month_year)
    db.commit()
    db.refresh(summary)
    return summary
