import subprocess, re, json
from urllib.request import urlopen, Request
from urllib.error import URLError

from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime


class StatusService:
    """
    Manages system status, version info, and service controls.
    """
    SERVER_REPO_DIR = Path("/shared/ProSep")
    STATE_FILE = Path("/var/www/.deployed_tag")
    FRONTEND_URL = "http://protein-separation-sim.se.rit.edu/"

    BACKEND_SERVICE = "prosep-backend.service"
    APACHE_SERVICE = "apache2"
    DEPLOY_SERVICE = "prosep-deploy.service"
    DEPLOY_TIMER = "prosep-deploy.timer"
    
    _version_locked = False
    _auto_update_active = True
    _auto_update_interval = 1
    _cached_repo_dir = None
    

    @classmethod
    def _get_repo_dir(cls) -> Optional[Path]:
        if cls._cached_repo_dir:
            return cls._cached_repo_dir
        
        # Server: use configured path
        if cls.SERVER_REPO_DIR.exists():
            cls._cached_repo_dir = cls.SERVER_REPO_DIR
            return cls._cached_repo_dir
        
        # IF Dev - Find git root:
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                cls._cached_repo_dir = Path(result.stdout.strip())
                return cls._cached_repo_dir
            
        except (subprocess.SubprocessError, FileNotFoundError):
            pass
        
        return None


    @classmethod
    def _is_server_environment(cls) -> bool:
        if not cls.SERVER_REPO_DIR.exists():
            return False
        
        try:
            result = subprocess.run(
                ["systemctl", "list-unit-files", cls.BACKEND_SERVICE],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        
        except (subprocess.SubprocessError, FileNotFoundError):
            return False


    @classmethod
    def _run_command(cls, cmd: list, timeout: int = 10, cwd: Optional[Path] = None) -> Optional[str]:
        try:
            if cwd is None:
                cwd = cls._get_repo_dir()
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=cwd
            )
            if result.returncode == 0:
                return result.stdout.strip()
            
            return None
        
        except (subprocess.SubprocessError, FileNotFoundError):
            return None
    

    @classmethod
    def _get_git_tags(cls) -> list[str]:
        repo_dir = cls._get_repo_dir()
        if not repo_dir: return []
        
        cls._run_command(["git", "fetch", "--tags"], cwd=repo_dir)
        
        output = cls._run_command(
            ["git", "tag", "--sort=-version:refname"],
            cwd=repo_dir
        )
        
        if output: return [tag for tag in output.split('\n') if tag]
        return []
    

    @classmethod
    def _get_latest_tag(cls) -> Optional[str]:
        tags = cls._get_git_tags()
        return tags[0] if tags else None
    

    @classmethod
    def _get_deployed_tag(cls) -> Tuple[Optional[str], bool]:
        if not cls.STATE_FILE.exists():
            return None, False
        
        try:
            content = cls.STATE_FILE.read_text().strip()

            if content.endswith('-locked'):
                tag = content[:-7]  # Remove '-locked' suffix
                return tag, True
            
            return content, False
        
        except (IOError, OSError):
            return None, False
    

    @classmethod
    def _get_tag_info(cls, tag: str) -> dict:
        repo_dir = cls._get_repo_dir()
        creation_date = "Unknown"

        if not repo_dir or not tag:
            return {"date": "Unknown", "notes": ""}
        
        date_output = cls._run_command(
            ["git", "log", "-1", "--format=%ci", tag],
            cwd=repo_dir
        )

        notes_output = cls._run_command(
            ["git", "tag", "-l", "--format=%(contents)", tag],
            cwd=repo_dir
        )
        
        if not notes_output or notes_output.strip() == "":
            notes_output = cls._run_command(
                ["git", "log", "-1", "--format=%B", tag],
                cwd=repo_dir
            )
        
        if date_output:
            try:
                dt = datetime.fromisoformat(date_output.split()[0])
                creation_date = dt.strftime("%Y-%m-%d")

            except (ValueError, IndexError):
                pass
        
        return {
            "date": creation_date,
            "notes": notes_output.strip() if notes_output else ""
        }
    

    @classmethod
    def _is_service_active(cls, service_name: str) -> bool:
        output = cls._run_command(["systemctl", "is-active", service_name])
        return output == "active"
    

    @classmethod
    def _is_service_enabled(cls, service_name: str) -> bool:
        output = cls._run_command(["systemctl", "is-enabled", service_name])
        return output == "enabled"
    

    @classmethod
    def _is_uvicorn_running_dev(cls) -> bool:
        try:
            result = subprocess.run(
                ["pgrep", "-f", "uvicorn.*backend.server:app"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        
        except (subprocess.SubprocessError, FileNotFoundError):
            return False
    

    @classmethod
    def _get_system_uptime(cls) -> str:
        uptime_output = cls._run_command(["uptime", "-p"])

        if uptime_output:
            return uptime_output.replace("up ", "")
        
        return "Unknown"
    

    @classmethod
    def _parse_github_repo(cls) -> Optional[Tuple[str, str]]:
        repo_dir = cls._get_repo_dir()
        if not repo_dir: return None
        
        remote_url = cls._run_command(["git", "remote", "get-url", "origin"], cwd=repo_dir)

        if not remote_url:
            return None

        patterns = [
            r'github\.com[:/]([^/]+)/(.+?)(?:\.git)?$',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, remote_url)

            if match:
                owner, repo = match.groups()
                return owner, repo.rstrip('.git')
        
        return None
    

    @classmethod
    def _fetch_prs_between_tags(cls, prev_tag: str, current_tag: str) -> list[dict]:
        repo_info = cls._parse_github_repo()
        if not repo_info: return []
        
        owner, repo = repo_info
        url = f"https://api.github.com/repos/{owner}/{repo}/compare/{prev_tag}...{current_tag}"
        seen_prs = set()
        prs = []
        
        try:
            req = Request(url)
            req.add_header('Accept', 'application/vnd.github+json')
            
            with urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode())
            
            for commit in data.get('commits', []):
                commit_msg = commit.get('commit', {}).get('message', '')
                pr_matches = re.findall(r'#(\d+)', commit_msg)
                
                for pr_num in pr_matches:
                    pr_int = int(pr_num)

                    if pr_int in seen_prs:
                        continue
                    
                    seen_prs.add(pr_int)

                    first_line = commit_msg.split('\n')[0]
                    title = re.sub(r'\s*\(#\d+\)\s*$', '', first_line)
                    title = re.sub(r'^Merge pull request #\d+.*?:\s*', '', title)
                    
                    prs.append({
                        "id": pr_int,
                        "title": title.strip(),
                        "url": f"https://github.com/{owner}/{repo}/pull/{pr_int}"
                    })
            
            return sorted(prs, key=lambda x: x['id'], reverse=True)
        
        except (URLError, json.JSONDecodeError, KeyError, ValueError):
            return []
    

    @classmethod
    def get_version_info(cls) -> dict:
        is_server = cls._is_server_environment()
        cur_tag, is_locked = cls._get_deployed_tag()
        available_tags = cls._get_git_tags()
        latest_tag = cls._get_latest_tag()
        prs = []
        
        # Dev mode:
        if not is_server and latest_tag:
            cur_tag = latest_tag
            is_locked = False
        
        # Limit to most recent 6 versions:
        tag_to_check = cur_tag or latest_tag
        available_tags = available_tags[:6] if len(available_tags) > 6 else available_tags
        tag_info = cls._get_tag_info(tag_to_check) if tag_to_check else {"date": "Unknown", "notes": ""}
        
        # Fetch tag PRs:
        if tag_to_check and available_tags:
            try:
                cur_idx = available_tags.index(tag_to_check)

                if cur_idx < len(available_tags) - 1:
                    prev_tag = available_tags[cur_idx + 1]
                    prs = cls._fetch_prs_between_tags(prev_tag, tag_to_check)

            except ValueError:
                pass
        
        return {
            "version": cur_tag or "Unknown",
            "remote_version": latest_tag or "Unknown",
            "creation_date": tag_info["date"],
            "notes": tag_info["notes"] or "Check Git history for details.",
            "prs": prs,
            "available_versions": available_tags,
            "locked": is_locked
        }
    

    @classmethod
    def get_performance_metrics(cls) -> dict:
        is_server = cls._is_server_environment()
        uvicorn_running = False
        apache_running = False
        
        if is_server:
            apache_running = cls._is_service_active(cls.APACHE_SERVICE)
            uvicorn_running = cls._is_service_active(cls.BACKEND_SERVICE)
            uptime_str = cls._get_system_uptime()

        else:
            uvicorn_running = cls._is_uvicorn_running_dev()
            uptime_str = "None"

        return {
            "uptime": uptime_str,
            "apache": {
                "requests_per_minute": 0,  # Need apache log parsing
                "error_rate": 0.0,
                "avg_response_time": 0,
                "service_running": apache_running
            },
            "uvicorn": {
                "requests_per_minute": 0,  # Need application metrics
                "error_rate": 0.0,
                "avg_response_time": 0,
                "process_running": uvicorn_running
            }
        }
    

    @classmethod
    def get_auto_update_status(cls) -> dict:
        is_server = cls._is_server_environment()
        
        active = False
        enabled = False
        
        if is_server:
            active = cls._is_service_active(cls.DEPLOY_TIMER)
            enabled = cls._is_service_enabled(cls.DEPLOY_TIMER)
        
        interval = cls._get_timer_interval() if is_server else cls._auto_update_interval
        
        return {
            "active": active and enabled,
            "interval_minutes": interval
        }
    

    @classmethod
    def _get_timer_interval(cls) -> int:
        try:
            output = cls._run_command([
                "systemctl", "show", cls.DEPLOY_TIMER, 
                "--property=TimersCalendar", "--value"
            ])
            
            if output: # Parse systemd timer format ("*:0/5" = every 5 minutes):
                match = re.search(r'/(\d+)', output)
                if match: return int(match.group(1))

        except Exception:
            pass
        
        return cls._auto_update_interval
    
    
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
        return {
            "success": True,
            "services": ["apache", "uvicorn"],
            "message": "Application restart initiated"
        }
