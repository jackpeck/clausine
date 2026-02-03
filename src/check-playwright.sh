#!/bin/bash
# Check if playwright is installed

if npm ls playwright 2>/dev/null | grep -q playwright; then
    echo "playwright is installed"
    exit 0
else
    echo "playwright is NOT installed - run: npm install"
    exit 1
fi
