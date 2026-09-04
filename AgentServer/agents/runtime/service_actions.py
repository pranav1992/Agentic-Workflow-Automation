from __future__ import annotations

import random
import string

from sqlmodel import Session, select

from app.infrastructure.db.engine import engine
from app.infrastructure.db.models import (
    Escalation,
    RepairOrder,
    ServiceAppointment,
    ServicePricing,
)


def _confirmation_code() -> str:
    return "SA-" + "".join(random.choices(string.digits, k=6))


def book_appointment(args: dict) -> str:
    """Persists a real ServiceAppointment row and returns a confirmation."""
    service_type = str(args.get("service_type") or "").strip()
    preferred_date = str(args.get("preferred_date") or "").strip()
    preferred_time = str(args.get("preferred_time") or "").strip()
    if not service_type or not preferred_date:
        return "I need at least a service type and a preferred date to book the appointment."

    code = _confirmation_code()
    with Session(engine) as session:
        session.add(
            ServiceAppointment(
                confirmation_code=code,
                vehicle_vin=str(args.get("vehicle_vin") or ""),
                service_type=service_type,
                scheduled_date=preferred_date,
                scheduled_time=preferred_time,
                customer_phone=str(args.get("customer_phone") or ""),
            )
        )
        session.commit()

    return (
        f"Booked: {service_type} on {preferred_date}"
        f"{f' at {preferred_time}' if preferred_time else ''}. "
        f"Confirmation code {code}."
    )


def lookup_repair_order(args: dict) -> str:
    """Looks up a real RepairOrder by order number or VIN."""
    order_number = str(args.get("repair_order_number") or "").strip()
    vin = str(args.get("vehicle_vin") or "").strip()
    if not order_number and not vin:
        return "I need either the repair order number or the vehicle VIN to look that up."

    with Session(engine) as session:
        stmt = select(RepairOrder)
        stmt = (
            stmt.where(RepairOrder.order_number == order_number)
            if order_number
            else stmt.where(RepairOrder.vehicle_vin == vin)
        )
        order = session.exec(stmt).first()

    if order is None:
        return "I couldn't find a repair order matching that. Could you double-check the order number or VIN?"

    return (
        f"Repair order {order.order_number}: {order.description} "
        f"Status: {order.status}. Estimated completion: {order.estimated_completion}."
    )


def get_price_quote(args: dict) -> str:
    """Quotes a real ServicePricing row, with a loose fallback match."""
    requested = str(args.get("service_type") or "").strip().lower()
    if not requested:
        return "What service or part would you like a price for?"

    with Session(engine) as session:
        rows = session.exec(select(ServicePricing)).all()

    match = next((r for r in rows if r.service_type.lower() == requested), None)
    if match is None:
        match = next((r for r in rows if requested in r.service_type.lower()), None)

    if match is None:
        available = ", ".join(sorted(r.service_type for r in rows))
        return f"I don't have pricing for '{requested}'. Services I can quote: {available}."

    price = match.price_cents / 100
    quote = f"{match.service_type.capitalize()}: ${price:,.2f}."
    if match.description:
        quote += f" {match.description}"
    return quote


def escalate_to_human(args: dict) -> str:
    """Persists a real Escalation ticket for a human advisor to pick up."""
    with Session(engine) as session:
        escalation = Escalation(
            reason=str(args.get("reason") or ""),
            customer_phone=str(args.get("customer_phone") or ""),
            location=str(args.get("location") or ""),
        )
        session.add(escalation)
        session.commit()
        session.refresh(escalation)
        ticket_id = str(escalation.id)[:8]

    return (
        f"A human advisor has been notified (ticket {ticket_id}) and will follow up shortly. "
        "Stay on the line if this is a safety emergency."
    )


# Dispatch table for the demo workflow's known tool names. Any tool the
# workflow graph defines that isn't listed here still works — it just gets
# AgentFactory's generic mocked response, since there's no real backend for
# arbitrary user-defined tools.
KNOWN_TOOL_HANDLERS = {
    "book_appointment": book_appointment,
    "lookup_repair_order": lookup_repair_order,
    "get_price_quote": get_price_quote,
    "escalate_to_human": escalate_to_human,
}
