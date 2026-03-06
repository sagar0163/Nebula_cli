# Fish Shell Completions for Nebula-CLI
# Save as: ~/.config/fish/completions/nebula.fish

complete -c nebula -f -l verbose -d 'Enable verbose logging'
complete -c nebula -f -l quiet -d 'Suppress non-essential output'
complete -c nebula -f -l config -d 'Specify config file' -r
complete -c nebula -f -l help -d 'Show help message'

complete -c nebula -f -a 'session' -d 'Start interactive shell'
complete -c nebula -f -a 'ask' -d 'Ask AI for help'
complete -c nebula -f -a 'chat' -d 'Chat with AI'
complete -c nebula -f -a 'predict' -d 'Predict next command'
complete -c nebula -f -a 'release' -d 'Create release'
complete -c nebula -f -a 'status' -d 'Show status'
complete -c nebula -f -a 'efficiency' -d 'Show token usage'
complete -c nebula -f -a 'help' -d 'Show help'
