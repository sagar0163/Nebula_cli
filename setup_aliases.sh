#!/bin/bash

# Define aliases
ALIAS_TRAIN='alias nebula-train="export TRAINING_MODE=true && echo \"🚀 TRAINING MODE: HF Space only\" && nebula"'
ALIAS_NORMAL='alias nebula-normal="export TRAINING_MODE=false && echo \"⚡ NORMAL MODE: Smart failover\" && nebula"'
ALIAS_PLAN='alias nebula-plan="export TRAINING_MODE=false && nebula plan"'

# Backup .bashrc
cp ~/.bashrc ~/.bashrc.bak.nebula

# check if aliases exist
if grep -q "nebula-train" ~/.bashrc; then
    echo "Aliases already exist in .bashrc"
else
    echo "" >> ~/.bashrc
    echo "# Nebula AI Mode Aliases" >> ~/.bashrc
    echo "$ALIAS_TRAIN" >> ~/.bashrc
    echo "$ALIAS_NORMAL" >> ~/.bashrc
    echo "$ALIAS_PLAN" >> ~/.bashrc
    echo "Added aliases to .bashrc"
fi

echo "Please run: source ~/.bashrc"
