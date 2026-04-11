"""Webhook dispatch, signing, and retry logic.

Dispatches signed HTTP POST notifications to registered webhook endpoints
when validation events occur (completion or failure).
"""

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone

import httpx

from app.dependencies import get_supabase_client

logger = logging.getLogger(__name__)

WEBHOOK_TIMEOUT = 10  # seconds
MAX_ATTEMPTS = 3
BACKOFF_DELAYS = [5, 30]  # seconds between retries


def sign_payload(payload_str: str, secret: str) -> str:
    """HMAC-SHA256 signing of a payload string. Returns hex digest."""
    return hmac.new(
        secret.encode("utf-8"),
        payload_str.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def deliver_webhook(
    delivery_id: str,
    url: str,
    secret: str,
    event: str,
    data: dict,
) -> None:
    """Deliver a webhook payload to a single endpoint with retry logic.

    On success (2xx): marks delivery as 'delivered'.
    On failure after MAX_ATTEMPTS: marks delivery as 'failed'.
    """
    supabase = get_supabase_client()

    payload = {
        "event": event,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    payload_str = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    signature = sign_payload(payload_str, secret)

    headers = {
        "Content-Type": "application/json",
        "X-TruQC-Signature": f"sha256={signature}",
        "X-TruQC-Event": event,
    }

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            resp = httpx.post(
                url,
                content=payload_str,
                headers=headers,
                timeout=WEBHOOK_TIMEOUT,
            )

            # Update delivery record
            response_body = resp.text[:1000] if resp.text else ""

            if 200 <= resp.status_code < 300:
                supabase.table("webhook_deliveries").update({
                    "status": "delivered",
                    "attempts": attempt,
                    "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                    "response_status": resp.status_code,
                    "response_body": response_body,
                }).eq("id", delivery_id).execute()
                logger.info(
                    "Webhook delivered: %s -> %s (attempt %d)",
                    event, url, attempt,
                )
                return

            # Non-2xx response
            logger.warning(
                "Webhook %s to %s returned %d (attempt %d/%d)",
                event, url, resp.status_code, attempt, MAX_ATTEMPTS,
            )
            supabase.table("webhook_deliveries").update({
                "attempts": attempt,
                "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                "response_status": resp.status_code,
                "response_body": response_body,
            }).eq("id", delivery_id).execute()

        except Exception as exc:
            logger.warning(
                "Webhook %s to %s failed (attempt %d/%d): %s",
                event, url, attempt, MAX_ATTEMPTS, str(exc),
            )
            supabase.table("webhook_deliveries").update({
                "attempts": attempt,
                "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                "response_body": str(exc)[:1000],
            }).eq("id", delivery_id).execute()

        # Retry with backoff if not last attempt
        if attempt < MAX_ATTEMPTS:
            delay = BACKOFF_DELAYS[attempt - 1] if attempt - 1 < len(BACKOFF_DELAYS) else BACKOFF_DELAYS[-1]
            time.sleep(delay)

    # All attempts exhausted -- mark as failed
    supabase.table("webhook_deliveries").update({
        "status": "failed",
    }).eq("id", delivery_id).execute()
    logger.error("Webhook %s to %s failed after %d attempts", event, url, MAX_ATTEMPTS)


def dispatch_webhooks(dataset_id: str, event: str, payload: dict) -> None:
    """Dispatch webhooks for a dataset event to all matching active endpoints.

    Looks up the org via dataset -> jobs -> projects chain, then sends to all
    active endpoints subscribed to the given event.

    Never raises -- all errors are caught to avoid crashing the validation
    background task.
    """
    try:
        supabase = get_supabase_client()

        # Get org_id by joining dataset -> job -> project
        dataset_result = supabase.table("datasets").select("job_id").eq("id", dataset_id).single().execute()
        if not dataset_result.data:
            logger.warning("dispatch_webhooks: dataset %s not found", dataset_id)
            return

        job_id = dataset_result.data["job_id"]
        job_result = supabase.table("jobs").select("project_id").eq("id", job_id).single().execute()
        if not job_result.data:
            logger.warning("dispatch_webhooks: job %s not found", job_id)
            return

        project_id = job_result.data["project_id"]
        project_result = supabase.table("projects").select("org_id").eq("id", project_id).single().execute()
        if not project_result.data:
            logger.warning("dispatch_webhooks: project %s not found", project_id)
            return

        org_id = project_result.data["org_id"]

        # Query active webhook endpoints for this org that subscribe to this event
        endpoints_result = (
            supabase.table("webhook_endpoints")
            .select("id,url,secret,events")
            .eq("org_id", org_id)
            .eq("active", "true")
            .execute()
        )

        endpoints = endpoints_result.data if endpoints_result.data else []

        for endpoint in endpoints:
            # Check if this endpoint subscribes to this event
            endpoint_events = endpoint.get("events", [])
            if event not in endpoint_events:
                continue

            # Create pending delivery record
            try:
                delivery_data = {
                    "endpoint_id": endpoint["id"],
                    "event": event,
                    "payload": payload,
                    "status": "pending",
                    "attempts": 0,
                }
                delivery_result = supabase.table("webhook_deliveries").insert(delivery_data).execute()
                delivery_id = delivery_result.data[0]["id"] if delivery_result.data else None

                if delivery_id:
                    deliver_webhook(
                        delivery_id=delivery_id,
                        url=endpoint["url"],
                        secret=endpoint.get("secret", ""),
                        event=event,
                        data=payload,
                    )
            except Exception as deliver_err:
                logger.error(
                    "Failed to deliver webhook to %s: %s",
                    endpoint.get("url", "unknown"),
                    str(deliver_err),
                )

    except Exception as e:
        logger.error("dispatch_webhooks failed for dataset %s: %s", dataset_id, str(e))
