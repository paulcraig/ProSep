import subprocess, re, json

from urllib.request import urlopen, Request
from urllib.error import URLError

from typing import Optional, Tuple
from datetime import datetime
from threading import Timer
from pathlib import Path


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
        try:
            result = subprocess.run(
                ["systemctl", "is-active", service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip() == "active"
        
        except (subprocess.SubprocessError, FileNotFoundError):
            return False
    

    @classmethod
    def _is_service_enabled(cls, service_name: str) -> bool:
        try:
            result = subprocess.run(
                ["systemctl", "is-enabled", service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip() == "enabled"
        
        except (subprocess.SubprocessError, FileNotFoundError):
            return False
    

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
    def _get_uvicorn_uptime_dev(cls) -> str:
        try:
            result = subprocess.run(
                ["pgrep", "-f", "uvicorn.*backend.server:app"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0 or not result.stdout.strip():
                return "Unknown"
            
            pid = result.stdout.strip().split()[0]
            
            result = subprocess.run(
                ["ps", "-o", "etime=", "-p", pid],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0 and result.stdout.strip():
                etime = result.stdout.strip()
                return cls._parse_elapsed_time(etime)
            
            return "Unknown"
        
        except (subprocess.SubprocessError, FileNotFoundError):
            return "Unknown"
    

    @classmethod
    def _parse_elapsed_time(cls, etime: str) -> str:
        parts = etime.strip().split('-')
        
        if len(parts) == 2:  # Days present
            days = parts[0]
            time_part = parts[1]
        else:
            days = None
            time_part = parts[0]
        
        time_components = time_part.split(':')
        
        result = []
        
        if days:
            result.append(f"{days}d")
        
        if len(time_components) == 3:  # hh:mm:ss
            hours, minutes, _ = time_components

            if int(hours) > 0:
                result.append(f"{int(hours)}h")

            if int(minutes) > 0:
                result.append(f"{int(minutes)}m")

        elif len(time_components) == 2:  # mm:ss
            minutes, _ = time_components

            if int(minutes) > 0:
                result.append(f"{int(minutes)}m")
        
        return ' '.join(result) if result else "< 1m"
    

    @classmethod
    def _get_build_age(cls) -> str:
        repo_dir = cls._get_repo_dir()
        if not repo_dir: return "Unknown"
        
        current_tag, _ = cls._get_deployed_tag()
        if not current_tag: return "Unknown"
        
        try:
            result = subprocess.run(
                ["git", "log", "-1", "--format=%ct", current_tag],
                capture_output=True,
                text=True,
                timeout=5,
                cwd=repo_dir
            )
            
            if result.returncode != 0 or not result.stdout.strip():
                return "Unknown"
            
            tag_timestamp = int(result.stdout.strip())
            tag_datetime = datetime.fromtimestamp(tag_timestamp)
            now = datetime.now()
            
            delta = now - tag_datetime
            total_seconds = int(delta.total_seconds())
            
            days = total_seconds // 86400
            hours = (total_seconds % 86400) // 3600
            
            if days >= 7:
                weeks = days // 7
                remaining_days = days % 7
                return f"{weeks} week{'s' if weeks != 1 else ''}, {remaining_days} day{'s' if remaining_days != 1 else ''}"
            
            else:
                return f"{days} day{'s' if days != 1 else ''}, {hours} hour{'s' if hours != 1 else ''}"
        
        except Exception:
            return "Unknown"
    

    @classmethod
    def _parse_log_metrics(cls, log_path: str, filter_requests: bool = False) -> dict:
        try:
            result = subprocess.run(
                ["tail", "-n", "1000", log_path],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0 or not result.stdout.strip():
                return {"requests_per_minute": 0, "error_rate": 0.0, "avg_response_time": 0}
            
            lines = result.stdout.strip().split('\n')
            total_requests = 0
            error_count = 0
            response_times = []
            
            for line in lines:
                if filter_requests and not any(m in line for m in ['"GET ', '"POST ', '"PUT ', '"DELETE ', '"PATCH ']):
                    continue
                
                total_requests += 1
                
                # Count only 5xx errors:
                status_match = re.search(r'" (\d{3}) ', line)

                if status_match and int(status_match.group(1)) >= 500:
                    error_count += 1
                
                time_match = re.search(r' (\d+)$', line)

                if time_match:
                    try: response_times.append(int(time_match.group(1)) / 1000)
                    except ValueError: pass
            
            if total_requests == 0:
                return {"requests_per_minute": 0, "error_rate": 0.0, "avg_response_time": 0}
            
            return {
                "requests_per_minute": min(total_requests, 100),
                "error_rate": round((error_count / total_requests * 100), 2),
                "avg_response_time": int(sum(response_times) / len(response_times)) if response_times else 0
            }
        
        except Exception:
            return {"requests_per_minute": 0, "error_rate": 0.0, "avg_response_time": 0}
    

    @classmethod
    def _parse_apache_metrics(cls) -> dict:
        return cls._parse_log_metrics("/var/log/apache2/prosep_access.log")
    

    @classmethod
    def _parse_uvicorn_metrics(cls) -> dict:
        return cls._parse_log_metrics(str(cls.SERVER_REPO_DIR / "uvicorn.log"), filter_requests=True)
    

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
            uptime_str = cls._get_build_age()
            
            apache_metrics = cls._parse_apache_metrics() if apache_running else {
                "requests_per_minute": 0, "error_rate": 0.0, "avg_response_time": 0
            }
            uvicorn_metrics = cls._parse_uvicorn_metrics() if uvicorn_running else {
                "requests_per_minute": 0, "error_rate": 0.0, "avg_response_time": 0
            }

        else:
            uvicorn_running = cls._is_uvicorn_running_dev()
            uptime_str = cls._get_uvicorn_uptime_dev() if uvicorn_running else "None"
            apache_metrics = {"requests_per_minute": 0, "error_rate": 0.0, "avg_response_time": 0}
            uvicorn_metrics = {"requests_per_minute": 0, "error_rate": 0.0, "avg_response_time": 0}

        return {
            "uptime": uptime_str,
            "apache": {
                "requests_per_minute": apache_metrics["requests_per_minute"],
                "error_rate": apache_metrics["error_rate"],
                "avg_response_time": apache_metrics["avg_response_time"],
                "service_running": apache_running
            },
            "uvicorn": {
                "requests_per_minute": uvicorn_metrics["requests_per_minute"],
                "error_rate": uvicorn_metrics["error_rate"],
                "avg_response_time": uvicorn_metrics["avg_response_time"],
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
            result = subprocess.run(
                ["systemctl", "show", cls.DEPLOY_TIMER, "--property=TimersCalendar", "--value"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            # Parse systemd timer format ("*:0/5" = every 5 minutes):
            if result.returncode == 0 and result.stdout.strip():
                output = result.stdout.strip()
                match = re.search(r'/(\d+)', output)
                if match: return int(match.group(1))

        except Exception:
            pass
        
        return cls._auto_update_interval
    
    
    @classmethod
    def checkout_version(cls, version: str, lock: bool = False) -> dict:
        if not cls._is_server_environment():
            return {
                "success": False,
                "version": version,
                "locked": lock,
                "message": "Version checkout only available on server"
            }
        
        try:
            cmd = ["/usr/local/bin/prosep-deploy.sh", "--force-rebuild", version]
            
            if lock:
                cmd.extend(["--lock-version", version])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes for build
            )
            
            success = result.returncode == 0
            
            return {
                "success": success,
                "version": version,
                "locked": lock,
                "message": f"Deployed version {version}" if success else f"Deployment failed: {result.stderr[:200]}"
            }
        
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "version": version,
                "locked": lock,
                "message": "Deployment timed out"
            }
        except Exception as e:
            return {
                "success": False,
                "version": version,
                "locked": lock,
                "message": f"Deployment error: {str(e)}"
            }
    

    @classmethod
    def set_version_lock(cls, locked: bool) -> dict:
        if not cls._is_server_environment():
            return {
                "success": False,
                "locked": locked,
                "message": "Version locking only available on server"
            }
        
        try:
            if locked:
                cmd = ["/usr/local/bin/prosep-deploy.sh", "--lock-version"]
            else:
                cmd = ["/usr/local/bin/prosep-deploy.sh", "--unlock-version"]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            success = result.returncode == 0
            
            return {
                "success": success,
                "locked": locked,
                "message": f"Version {'locked' if locked else 'unlocked'}" if success else f"Lock operation failed: {result.stderr[:200]}"
            }
        
        except Exception as e:
            return {
                "success": False,
                "locked": locked,
                "message": f"Lock operation error: {str(e)}"
            }
    

    @classmethod
    def set_auto_update_active(cls, active: bool) -> dict:
        if not cls._is_server_environment():
            return {
                "success": False,
                "active": active,
                "message": "Auto-update control only available on server"
            }
        
        try:
            if active:
                cmd = ["systemctl", "enable", "--now", cls.DEPLOY_TIMER]
            else:
                cmd = ["systemctl", "disable", "--now", cls.DEPLOY_TIMER]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            success = result.returncode == 0
            status_text = "activated" if active else "deactivated"
            
            return {
                "success": success,
                "active": active,
                "message": f"Auto-update service {status_text}" if success else f"Timer operation failed: {result.stderr[:200]}"
            }
        
        except Exception as e:
            return {
                "success": False,
                "active": active,
                "message": f"Timer operation error: {str(e)}"
            }
    

    @classmethod
    def set_auto_update_interval(cls, interval_minutes: int) -> dict:
        """
        Note: This is not implemented - timer interval must be changed manually.
        """
        return {
            "success": False,
            "interval_minutes": interval_minutes,
            "message": "Changing timer interval requires manual editing of /etc/systemd/system/prosep-deploy.timer"
        }
    

    @classmethod
    def restart_apache(cls) -> dict:
        if not cls._is_server_environment():
            return {
                "success": False,
                "service": "apache",
                "message": "Service restart only available on server"
            }
        
        try:
            result = subprocess.run(
                ["systemctl", "restart", cls.APACHE_SERVICE],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            success = result.returncode == 0
            
            # Verify it's running
            if success:
                success = cls._is_service_active(cls.APACHE_SERVICE)
            
            return {
                "success": success,
                "service": "apache",
                "message": "Apache service restarted" if success else f"Restart failed: {result.stderr[:200]}"
            }
        
        except Exception as e:
            return {
                "success": False,
                "service": "apache",
                "message": f"Restart error: {str(e)}"
            }
    

    @classmethod
    def restart_uvicorn(cls) -> dict:
        if not cls._is_server_environment():
            return {
                "success": False,
                "service": "uvicorn",
                "message": "Service restart only available on server"
            }
        
        try:
            subprocess.Popen(
                ["systemctl", "restart", cls.BACKEND_SERVICE],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            return {
                "success": True,
                "service": "uvicorn",
                "message": "Uvicorn service restart initiated"
            }
        
        except Exception as e:
            return {
                "success": False,
                "service": "uvicorn",
                "message": f"Restart error: {str(e)}"
            }
    

    @classmethod
    def restart_app(cls) -> dict:
        if not cls._is_server_environment():
            return {
                "success": False,
                "services": ["apache", "uvicorn"],
                "message": "Service restart only available on server"
            }
        
        apache_result = cls.restart_apache()
        uvicorn_result = cls.restart_uvicorn()
        
        return {
            "success": apache_result["success"] and uvicorn_result["success"],
            "services": ["apache", "uvicorn"],
            "message": "Application restart initiated"
        }
