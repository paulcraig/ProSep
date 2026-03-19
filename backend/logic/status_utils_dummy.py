class StatusService:
    """
    Manages system status, version info, and service controls.
    """
    _version_locked = False
    _auto_update_active = True
    _auto_update_interval = 1
    

    @classmethod
    def get_version_info(cls) -> dict:
        """
        Get current and remote version information.
        """
        return {
            "version": "v5.1.2",
            "remote_version": "v5.1.3",
            "creation_date": "2025-02-08",
            "notes": "Performance improvements and bug fixes for long running processes with memory optimization",
            "prs": [
                {"id": 142, "title": "Fix memory leak in peptide retention", "url": "#"},
                {"id": 141, "title": "Update dependencies", "url": "#"},
                {"id": 140, "title": "Improve error handling", "url": "#"}
            ],
            "available_versions": ["v5.1.2", "v5.1.1", "v5.1.0", "v5.0.3", "v5.0.2", "v4.1.0"],
            "locked": cls._version_locked
        }
    

    @classmethod
    def checkout_version(cls, version: str, lock: bool = False) -> dict:
        return {
            "success": True,
            "version": version,
            "locked": lock,
            "message": f"Checked out version {version}"
        }
    

    @classmethod
    def set_version_lock(cls, locked: bool) -> dict:
        cls._version_locked = locked
        return {
            "success": True,
            "locked": locked
        }
    

    @classmethod
    def get_performance_metrics(cls) -> dict:
        """
        Get server performance metrics.
        """
        return {
            "uptime": "7d 14h 32m",
            "apache": {
                "requests_per_minute": 3120,
                "error_rate": 0.02,
                "avg_response_time": 28,
                "service_running": True
            },
            "uvicorn": {
                "requests_per_minute": 2450,
                "error_rate": 0.15,
                "avg_response_time": 42,
                "process_running": True
            }
        }
    

    @classmethod
    def get_auto_update_status(cls) -> dict:
        return {
            "active": cls._auto_update_active,
            "interval_minutes": cls._auto_update_interval
        }
    

    @classmethod
    def set_auto_update_active(cls, active: bool) -> dict:
        cls._auto_update_active = active
        status_text = "activated" if active else "deactivated"
        return {
            "success": True,
            "active": active,
            "message": f"Auto-update service {status_text}"
        }
    

    @classmethod
    def set_auto_update_interval(cls, interval_minutes: int) -> dict:
        cls._auto_update_interval = interval_minutes
        return {
            "success": True,
            "interval_minutes": interval_minutes,
            "message": f"Auto-update interval set to {interval_minutes} minutes"
        }
    

    @classmethod
    def restart_apache(cls) -> dict:
        return {
            "success": True,
            "service": "apache",
            "message": "Apache service restart initiated"
        }
    

    @classmethod
    def restart_uvicorn(cls) -> dict:
        return {
            "success": True,
            "service": "uvicorn",
            "message": "Uvicorn service restart initiated"
        }
    

    @classmethod
    def restart_app(cls) -> dict:
        """
        Restart both Apache and Uvicorn services.
        """
        return {
            "success": True,
            "services": ["apache", "uvicorn"],
            "message": "Application restart initiated"
        }
