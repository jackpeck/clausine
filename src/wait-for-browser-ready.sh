#!/bin/bash
cd "$(dirname "$0")/.."
while [ ! -f .browser-ready ]; do sleep 0.5; done
echo "Browser ready"
