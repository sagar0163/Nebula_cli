// Shell Completions for Zsh
// Save as: ~/.local/share/zsh/site-functions/_nebula

#compdef nebula

local -a commands
commands=(
    'session:Start interactive shell'
    'ask:Ask AI for help with a task'
    'chat:Chat with AI'
    'predict:Predict next command'
    'release:Create a release'
    'status:Show status'
    'efficiency:Show token usage'
    'help:Show help'
)

_arguments -C \
    '(-v --verbose)'{-v,--verbose}'[Enable verbose logging]' \
    '(-q --quiet)'{-q,--quiet}'[Suppress output]' \
    '(-c --config)'{-c,--config}'[Specify config file]:config file:_files' \
    '(-h --help)'{-h,--help}'[Show help]' \
    '1: :->command' \
    '*: :->args' && return 0

case $state in
    command)
        _describe 'command' commands
        ;;
    args)
        case $words[1]
            ask|chat)
                _message 'prompt'
                ;;
            *)
                ;;
        esac
        ;;
esac
