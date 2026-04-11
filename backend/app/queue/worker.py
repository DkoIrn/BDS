"""Standalone worker entry point for Railway service.

Runs the procrastinate worker consuming from all job queues.
Start via: python -m app.queue.worker
"""

from app.queue import app


def main():
    """Start the procrastinate worker."""
    app.run_worker(
        queues=["validation", "reports", "exports"],
        concurrency=2,
        install_signal_handlers=True,
        listen_notify=True,
    )


if __name__ == "__main__":
    main()
