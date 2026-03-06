#!/bin/bash
# Nebula-CLI Shell Completions for Bash

_nebula() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    opts="session ask chat predict release status help efficiency"
    
    # Options
    global_opts="-v --verbose -q --quiet -c --config -h --help"
    
    # Check if we're at command position
    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
    
    # Check for option flags
    case "${prev}" in
        -c|--config)
            _filedir
            return 0
            ;;
        ask|chat)
            # These commands take arbitrary input, no completion
            return 0
            ;;
        *)
            ;;
    esac
    
    # Complete options if dash prefix
    if [[ "${cur}" == -* ]]; then
        COMPREPLY=( $(compgen -W "${global_opts}" -- ${cur}) )
        return 0
    fi
}

complete -F _nebula nebula
