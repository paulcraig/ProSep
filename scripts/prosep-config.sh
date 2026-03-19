#!/usr/bin/env bash

BACKEND_SERVICE="prosep-backend.service"
APACHE_SERVICE="apache2"
DEPLOY_SERVICE="prosep-deploy.service"
DEPLOY_TIMER="prosep-deploy.timer"

BASE_VERSION="v2.0.1"  # Lowest deployable version; if lower, scripts will break.

WWW_DIR="/var/www/html"
REPO_DIR="/shared/ProSep"
STATE_FILE="/var/www/.deployed_tag"
FRONTEND_URL="http://protein-separation-sim.se.rit.edu/"
